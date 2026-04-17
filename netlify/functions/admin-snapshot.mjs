export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method !== "GET") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const [members, notices, guests, attendanceLogs, raffleHistory, operationLogs, profiles, syncMeta] = await Promise.all([
      loadExistingMembers(),
      supabaseSelect("notices?select=id,title,content,created_at&order=created_at.desc&limit=300"),
      supabaseSelect("guests?select=id,name,birth_year,phone,message,status,created_at&order=created_at.desc&limit=500"),
      supabaseSelect("attendance_logs?select=id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at&order=created_at.desc&limit=200"),
      supabaseSelect("raffle_history?select=draw_id,target_month_key,threshold,winner_count,winners,created_at&order=created_at.desc&limit=100"),
      supabaseSelect("operation_logs?select=id,actor_name,action,detail,created_at&order=created_at.desc&limit=100"),
      supabaseSelect("member_profiles?select=user_id,email,name,birth_year,approval_status,role&order=created_at.desc&limit=500"),
      loadSetting("last_sync_meta")
    ]);

    return json(200, {
      ok: true,
      snapshot: {
        members: Array.isArray(members) ? members : [],
        notices: Array.isArray(notices) ? notices : [],
        guests: Array.isArray(guests) ? guests : [],
        attendance_logs: Array.isArray(attendanceLogs) ? attendanceLogs : [],
        raffle_history: Array.isArray(raffleHistory) ? raffleHistory : [],
        operation_logs: Array.isArray(operationLogs) ? operationLogs : [],
        member_profiles: Array.isArray(profiles) ? profiles : []
      },
      sync_meta: syncMeta?.value || null,
      sync_meta_updated_at: syncMeta?.updated_at || null,
      counts: {
        members: Array.isArray(members) ? members.length : 0,
        notices: Array.isArray(notices) ? notices.length : 0,
        guests: Array.isArray(guests) ? guests.length : 0,
        attendance_logs: Array.isArray(attendanceLogs) ? attendanceLogs.length : 0,
        raffle_history: Array.isArray(raffleHistory) ? raffleHistory.length : 0
      }
    });
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

  const profiles = await supabaseSelect(`member_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";

  return { ok: Boolean(isAdmin), user };
}

function extractBearerToken(header) {
  const [type, token] = String(header || "").split(" ");
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

async function loadExistingMembers() {
  const attempts = [
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active,created_at&order=created_at.desc&limit=500",
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status,is_active,created_at&order=created_at.desc&limit=500",
    "members?select=id,name,birth_year,total_runs,monthly_runs,is_active,created_at&order=created_at.desc&limit=500"
  ];

  for (const path of attempts) {
    try {
      return await supabaseSelect(path);
    } catch (error) {
      const missingKnownColumn = isMissingColumnError(error, "fee_status") || isMissingColumnError(error, "aliases") || isMissingColumnError(error, "is_active");
      if (!missingKnownColumn) {
        throw error;
      }
    }
  }

  return [];
}

async function loadSetting(key) {
  const rows = await supabaseSelect(`settings?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(String(columnName || "").toLowerCase()) && message.includes("does not exist");
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

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
