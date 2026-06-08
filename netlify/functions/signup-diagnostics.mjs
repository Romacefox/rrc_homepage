const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";
const BIRTH_YEAR_MIN = 1989;
const BIRTH_YEAR_MAX = 2004;

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
      if (query.length < 2) {
        return json(400, { ok: false, error: "검색어를 2자 이상 입력해 주세요." });
      }
      const result = await diagnoseSignup(query);
      return json(200, { ok: true, ...result });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const userId = String(body?.user_id || "").trim();
      if (!userId) {
        return json(400, { ok: false, error: "missing user_id" });
      }

      const authUser = await loadAuthUser(userId);
      if (!authUser?.id) {
        return json(404, { ok: false, error: "Auth 사용자를 찾을 수 없습니다." });
      }

      const existing = await loadProfileByUserId(authUser.id);
      if (existing?.user_id) {
        return json(200, { ok: true, recovered: false, profile: existing, message: "이미 프로필이 있습니다." });
      }

      const profile = buildPendingProfileFromAuthUser(authUser, body);
      await supabaseUpsert(PROFILE_TABLE, profile, "user_id");
      await tryInsertOperationLog(auth, profile, "회원가입 프로필 복구");
      return json(200, { ok: true, recovered: true, profile });
    }

    return json(405, { ok: false, error: "method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function diagnoseSignup(query) {
  const [authUsers, profiles] = await Promise.all([
    listAuthUsers(),
    supabaseSelect(`${PROFILE_TABLE}?select=user_id,email,name,birth_year,approval_status,role,created_at&limit=1000`)
  ]);

  const profileByUserId = new Map((Array.isArray(profiles) ? profiles : []).map((profile) => [String(profile.user_id || ""), profile]));
  const normalizedQuery = normalize(query);
  const items = [];

  (Array.isArray(authUsers) ? authUsers : []).forEach((user) => {
    const meta = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
    const haystack = normalize(`${user.email || ""} ${meta.name || ""}`);
    if (!haystack.includes(normalizedQuery)) {
      return;
    }
    const profile = profileByUserId.get(String(user.id || "")) || null;
    items.push({
      user_id: user.id,
      email: user.email || "",
      email_confirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
      metadata_name: meta.name || "",
      metadata_birth_year: Number(meta.birth_year || 0) || null,
      created_at: user.created_at || null,
      profile,
      status: profile?.approval_status || "profile_missing",
      recoverable: !profile?.user_id && Boolean(user.id && user.email)
    });
  });

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const haystack = normalize(`${profile.email || ""} ${profile.name || ""}`);
    const alreadyIncluded = items.some((item) => item.user_id === profile.user_id);
    if (!alreadyIncluded && haystack.includes(normalizedQuery)) {
      items.push({
        user_id: profile.user_id,
        email: profile.email || "",
        email_confirmed: null,
        metadata_name: "",
        metadata_birth_year: null,
        created_at: profile.created_at || null,
        profile,
        status: profile.approval_status || "profile_only",
        recoverable: false
      });
    }
  });

  return {
    items: items.slice(0, 20),
    counts: {
      auth_users: Array.isArray(authUsers) ? authUsers.length : 0,
      profiles: Array.isArray(profiles) ? profiles.length : 0,
      matches: items.length
    }
  };
}

function buildPendingProfileFromAuthUser(user, body) {
  const meta = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const name = String(body?.name || meta.name || "").trim();
  const birthYear = Number(body?.birth_year || meta.birth_year || 0);
  const intro = String(body?.intro || meta.intro || "").trim();

  if (!name || birthYear < BIRTH_YEAR_MIN || birthYear > BIRTH_YEAR_MAX) {
    throw new Error("복구에 필요한 이름/출생연도가 부족합니다. 가입자가 다시 로그인하거나 운영진이 Supabase metadata를 확인해 주세요.");
  }

  return {
    user_id: user.id,
    email: String(user.email || "").trim().toLowerCase(),
    name,
    birth_year: birthYear,
    intro,
    role: "member",
    approval_status: "pending"
  };
}

async function requireAdmin(request) {
  const token = extractBearerToken(request.headers.get("authorization") || "");
  if (!token) {
    return { ok: false };
  }
  const user = await fetchAuthedUser(token);
  if (!user?.id) {
    return { ok: false };
  }
  const profiles = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";
  return { ok: Boolean(isAdmin), user, profile };
}

async function listAuthUsers() {
  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/admin/users?per_page=1000&page=1`, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const result = await response.json();
  return Array.isArray(result?.users) ? result.users : [];
}

async function loadAuthUser(userId) {
  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function loadProfileByUserId(userId) {
  const rows = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,name,birth_year,approval_status,role,created_at&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
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

async function supabaseUpsert(table, payload, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function tryInsertOperationLog(auth, profile, action) {
  try {
    await supabaseInsert(LOG_TABLE, {
      actor_user_id: auth.user?.id || null,
      actor_name: String(auth.user?.email || "admin").slice(0, 120),
      action,
      detail: `${profile.name || profile.email || "회원"}: pending profile restored`
    });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (!message.includes("operation_logs")) {
      throw error;
    }
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

function extractBearerToken(header) {
  const [type, token] = String(header || "").split(" ");
  if ((type || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
