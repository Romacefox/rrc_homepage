const TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const action = url.searchParams.get("action") || "list";

      if (action === "list") {
        const items = await supabaseSelect(`${TABLE}?approval_status=eq.pending&order=created_at.desc&select=user_id,email,name,birth_year,intro,approval_status,role,created_at`);
        return json(200, { ok: true, items, can_manage_roles: auth.isOwner });
      }

      if (action === "list-all") {
        const items = await supabaseSelect(`${TABLE}?order=created_at.desc&select=user_id,email,name,birth_year,intro,approval_status,role,created_at&limit=300`);
        return json(200, { ok: true, items, can_manage_roles: auth.isOwner });
      }

      return json(400, { ok: false, error: "invalid action" });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const userId = body?.user_id;
      const status = body?.approval_status;
      const role = body?.role;

      if (!userId) {
        return json(400, { ok: false, error: "missing user_id" });
      }

      const patch = {};
      if (["approved", "rejected", "pending"].includes(status)) {
        patch.approval_status = status;
      }
      if (["member", "admin"].includes(role)) {
        patch.role = role;
      }

      if (Object.keys(patch).length === 0) {
        return json(400, { ok: false, error: "invalid payload" });
      }
      if (patch.role && !auth.isOwner) {
        return json(403, { ok: false, error: "owner only" });
      }
      if (patch.role && auth.user?.id === userId && patch.role !== "admin") {
        return json(400, { ok: false, error: "cannot demote self" });
      }

      const targetProfile = await getTargetProfile(userId);
      await supabasePatch(`${TABLE}?user_id=eq.${encodeURIComponent(userId)}`, patch);
      await tryInsertOperationLog(auth, targetProfile, patch);
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: "method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function requireAdmin(request) {
  const token = extractBearerToken(request.headers.get("authorization") || "");
  if (!token) {
    return { ok: false };
  }

  const user = await fetchAuthedUser(token);
  if (!user?.id) {
    return { ok: false };
  }

  const profiles = await supabaseSelect(`${TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";
  const ownerEmail = envOptional("OWNER_EMAIL").toLowerCase();
  const userEmail = String(user.email || "").toLowerCase();
  const isOwner = Boolean(ownerEmail) && userEmail === ownerEmail;

  return { ok: Boolean(isAdmin), user, isOwner };
}

async function getTargetProfile(userId) {
  const rows = await supabaseSelect(`${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,name,approval_status,role&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertOperationLog(auth, targetProfile, patch) {
  const displayName = String(targetProfile?.name || targetProfile?.email || "회원");
  const details = [];
  let action = "회원 정보 변경";

  if (patch.approval_status) {
    action = "회원 승인 상태 변경";
    details.push(`${displayName}: ${patch.approval_status}`);
  }
  if (patch.role) {
    action = patch.approval_status ? "회원 승인 및 권한 변경" : "회원 권한 변경";
    details.push(`${displayName}: ${patch.role}`);
  }

  await supabaseInsert(LOG_TABLE, {
    actor_user_id: auth.user?.id || null,
    actor_name: String(auth.user?.email || "admin").slice(0, 120),
    action,
    detail: details.join(" / ") || displayName
  });
}

async function tryInsertOperationLog(auth, targetProfile, patch) {
  try {
    await insertOperationLog(auth, targetProfile, patch);
  } catch (error) {
    const message = String(error?.message || error || "");
    const missingLogTable = message.includes("operation_logs") && message.includes("schema cache");
    if (!missingLogTable) {
      throw error;
    }
  }
}

function extractBearerToken(header) {
  if (!header) {
    return "";
  }
  const [type, token] = header.split(" ");
  if ((type || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

async function fetchAuthedUser(token) {
  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      apikey: env("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function envOptional(name) {
  return process.env[name] || "";
}

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

async function supabaseSelect(path) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function supabasePatch(path, payload) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function supabaseInsert(table, payload) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
