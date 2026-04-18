const TABLE = "reward_requests";
const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 10), 30));
      const rows = await listRequests(limit).catch((error) => {
        if (isMissingTableError(error, TABLE)) {
          return null;
        }
        throw error;
      });

      if (!rows) {
        return json(200, { ok: true, available: false, items: [], can_manage: auth.isAdmin });
      }

      const items = auth.isAdmin
        ? rows
        : rows.filter((item) => item.user_id === auth.user.id);

      return json(200, { ok: true, available: true, items, can_manage: auth.isAdmin });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const rewardCode = String(body?.reward_code || "").trim();
      const rewardName = String(body?.reward_name || "").trim();
      const pointCost = Number(body?.point_cost || 0);
      const note = String(body?.note || "").trim().slice(0, 300);

      if (!rewardCode || !rewardName || pointCost <= 0) {
        return json(400, { ok: false, error: "invalid payload" });
      }

      await supabaseInsert(TABLE, {
        user_id: auth.user.id,
        requester_name: auth.profile?.name || auth.user.email || "member",
        requester_email: auth.user.email || "",
        reward_code: rewardCode,
        reward_name: rewardName,
        point_cost: pointCost,
        note,
        status: "submitted"
      }).catch((error) => {
        if (isMissingTableError(error, TABLE)) {
          throw new Error("reward_requests table missing");
        }
        throw error;
      });

      await tryInsertOperationLog(auth, "RRC샵 보조 신청", `${rewardName} / ${pointCost}P`);
      return json(200, { ok: true });
    }

    if (request.method === "PATCH") {
      if (!auth.isAdmin) {
        return json(403, { ok: false, error: "admin only" });
      }

      const body = await request.json();
      const id = String(body?.id || "").trim();
      const status = String(body?.status || "").trim();
      if (!id || !["submitted", "approved", "fulfilled", "rejected"].includes(status)) {
        return json(400, { ok: false, error: "invalid payload" });
      }

      await supabasePatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        status,
        updated_at: new Date().toISOString()
      });
      await tryInsertOperationLog(auth, "RRC샵 보조 상태 변경", `${id}: ${status}`);
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: "method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function requireApprovedMember(request) {
  const token = extractBearerToken(request.headers.get("authorization") || "");
  if (!token) {
    return { ok: false };
  }

  const user = await fetchAuthedUser(token);
  if (!user?.id) {
    return { ok: false };
  }

  const rows = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,name,role,approval_status&limit=1`);
  const profile = Array.isArray(rows) ? rows[0] || null : null;
  const isApproved = profile?.approval_status === "approved";
  const isAdmin = isApproved && profile?.role === "admin";
  return { ok: Boolean(isApproved), user, profile, isAdmin };
}

async function listRequests(limit) {
  return supabaseSelect(`${TABLE}?order=created_at.desc&limit=${limit}&select=id,user_id,requester_name,reward_name,point_cost,note,status,created_at,updated_at`);
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

async function tryInsertOperationLog(auth, action, detail) {
  try {
    await supabaseInsert(LOG_TABLE, {
      actor_user_id: auth.user?.id || null,
      actor_name: String(auth.profile?.name || auth.user?.email || "admin").slice(0, 120),
      action,
      detail
    });
  } catch (error) {
    if (!isMissingTableError(error, LOG_TABLE)) {
      throw error;
    }
  }
}

function isMissingTableError(error, table) {
  const message = String(error?.message || error || "");
  return message.includes(table) && (message.includes("schema cache") || message.includes("does not exist"));
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
