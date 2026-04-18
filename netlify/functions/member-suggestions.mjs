const TABLE = "member_suggestions";
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
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 12), 50));
      const rows = await listSuggestions(limit).catch((error) => {
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
        : rows.filter((item) => {
            if (item.user_id === auth.user.id) {
              return true;
            }
            if (item.is_anonymous) {
              return false;
            }
            return ["submitted", "under_review", "planned", "completed"].includes(String(item.status || ""));
          });

      return json(200, { ok: true, available: true, items, can_manage: auth.isAdmin });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const title = String(body?.title || "").trim();
      const content = String(body?.content || "").trim();
      const isAnonymous = Boolean(body?.is_anonymous);

      if (!title || !content) {
        return json(400, { ok: false, error: "missing title or content" });
      }

      await supabaseInsert(TABLE, {
        user_id: auth.user.id,
        author_name: auth.profile?.name || auth.user.email || "member",
        author_email: auth.user.email || "",
        title: title.slice(0, 80),
        content: content.slice(0, 600),
        is_anonymous: isAnonymous,
        status: "submitted"
      }).catch((error) => {
        if (isMissingTableError(error, TABLE)) {
          throw new Error("member_suggestions table missing");
        }
        throw error;
      });

      await tryInsertOperationLog(auth, "회원 건의 등록", `${title.slice(0, 40)}`);
      return json(200, { ok: true });
    }

    if (request.method === "PATCH") {
      if (!auth.isAdmin) {
        return json(403, { ok: false, error: "admin only" });
      }

      const body = await request.json();
      const id = String(body?.id || "").trim();
      const status = String(body?.status || "").trim();
      if (!id || !["submitted", "under_review", "planned", "completed", "rejected"].includes(status)) {
        return json(400, { ok: false, error: "invalid payload" });
      }

      await supabasePatch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        status,
        updated_at: new Date().toISOString()
      });
      await tryInsertOperationLog(auth, "회원 건의 상태 변경", `${id}: ${status}`);
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
  return {
    ok: Boolean(isApproved),
    user,
    profile,
    isAdmin
  };
}

async function listSuggestions(limit) {
  return supabaseSelect(`${TABLE}?order=created_at.desc&limit=${limit}&select=id,user_id,author_name,title,content,status,is_anonymous,created_at,updated_at`);
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
