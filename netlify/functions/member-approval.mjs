const TABLE = "member_profiles";

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
        return json(200, { ok: true, items });
      }

      if (action === "list-all") {
        const items = await supabaseSelect(`${TABLE}?order=created_at.desc&select=user_id,email,name,birth_year,intro,approval_status,role,created_at&limit=300`);
        return json(200, { ok: true, items });
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

      await supabasePatch(`${TABLE}?user_id=eq.${encodeURIComponent(userId)}`, patch);
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

  return { ok: Boolean(isAdmin), user };
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

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
