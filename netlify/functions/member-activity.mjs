const PROFILE_TABLE = "member_profiles";

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method !== "GET") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const [members, attendanceLogs, raffleHistory] = await Promise.all([
      loadMembers(),
      loadAttendanceLogs(),
      loadRaffleHistory()
    ]);

    return json(200, {
      ok: true,
      members,
      attendance_logs: attendanceLogs,
      raffle_history: raffleHistory
    });
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
  return { ok: profile?.approval_status === "approved", user, profile };
}

async function loadMembers() {
  const attempts = [
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status,is_active&order=name.asc&limit=1000",
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status&order=name.asc&limit=1000",
    "members?select=id,name,birth_year,total_runs,monthly_runs,is_active&order=name.asc&limit=1000",
    "members?select=id,name,birth_year,total_runs,monthly_runs&order=name.asc&limit=1000"
  ];
  for (const path of attempts) {
    try {
      const rows = await supabaseSelect(path);
      return (Array.isArray(rows) ? rows : []).filter((member) => member?.is_active !== false);
    } catch (_error) {
      // Try the next schema-compatible select shape.
    }
  }
  return [];
}

async function loadAttendanceLogs() {
  return supabaseSelect("attendance_logs?select=event_type,attendance_date,matched&order=attendance_date.desc&limit=1000").catch(() => []);
}

async function loadRaffleHistory() {
  return supabaseSelect("raffle_history?select=target_month_key,threshold,winner_count,winners,created_at&order=created_at.desc&limit=20").catch(() => []);
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

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
