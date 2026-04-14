const PROFILE_TABLE = "member_profiles";
const MEMBER_TABLE = "members";
const ATTENDANCE_TABLE = "attendance_logs";
const LOG_TABLE = "operation_logs";

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const [profiles, currentMembers, attendanceLogs] = await Promise.all([
      supabaseSelect(`${PROFILE_TABLE}?approval_status=eq.approved&select=user_id,email,name,birth_year&order=created_at.asc&limit=500`),
      loadCurrentMembers(),
      supabaseSelect(`${ATTENDANCE_TABLE}?select=attendance_date,matched&order=attendance_date.asc&limit=1000`)
    ]);

    const rebuiltMembers = rebuildMembers(profiles, currentMembers, attendanceLogs);
    if (!rebuiltMembers.length) {
      return json(400, { ok: false, error: "approved member_profiles not found" });
    }

    await replaceMembers(rebuiltMembers);
    await tryInsertOperationLog(auth, rebuiltMembers.length);

    return json(200, {
      ok: true,
      counts: {
        members: rebuiltMembers.length,
        profiles: Array.isArray(profiles) ? profiles.length : 0,
        attendance_logs: Array.isArray(attendanceLogs) ? attendanceLogs.length : 0
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

  const profiles = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";

  return { ok: Boolean(isAdmin), user };
}

function rebuildMembers(profiles, currentMembers, attendanceLogs) {
  const runMap = aggregateAttendance(Array.isArray(attendanceLogs) ? attendanceLogs : []);
  const mergedByKey = new Map();

  (Array.isArray(currentMembers) ? currentMembers : []).forEach((member) => {
    const key = buildMemberKey(member.name, member.birth_year);
    const monthlyRunsFromLogs = runMap.get(normalizeName(member.name)) || {};
    const monthlyRuns = mergeMonthlyRuns(member.monthly_runs, monthlyRunsFromLogs);
    const totalRuns = Math.max(
      Number(member.total_runs || 0),
      Object.values(monthlyRuns).reduce((sum, value) => sum + Number(value || 0), 0)
    );

    mergedByKey.set(key, {
      name: String(member.name || "이름없음").slice(0, 80),
      birth_year: clampNumber(member.birth_year, 1989, 2000, 1994),
      total_runs: totalRuns,
      monthly_runs: monthlyRuns,
      fee_status: member.fee_status && typeof member.fee_status === "object" ? member.fee_status : {},
      aliases: Array.isArray(member.aliases) ? member.aliases : [],
      is_active: member.is_active !== false
    });
  });

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const key = buildMemberKey(profile.name, profile.birth_year);
    const current = mergedByKey.get(key) || null;
    const monthlyRuns = runMap.get(normalizeName(profile.name)) || {};
    const totalRuns = Object.values(monthlyRuns).reduce((sum, value) => sum + Number(value || 0), 0);

    mergedByKey.set(key, {
      name: String(profile.name || "이름없음").slice(0, 80),
      birth_year: clampNumber(profile.birth_year, 1989, 2000, 1994),
      total_runs: Math.max(totalRuns, Number(current?.total_runs || 0)),
      monthly_runs: mergeMonthlyRuns(current?.monthly_runs, monthlyRuns),
      fee_status: current?.fee_status && typeof current.fee_status === "object" ? current.fee_status : {},
      aliases: Array.isArray(current?.aliases) ? current.aliases : [],
      is_active: true
    });
  });

  return Array.from(mergedByKey.values()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}

function mergeMonthlyRuns(baseRuns, nextRuns) {
  const merged = {
    ...(baseRuns && typeof baseRuns === "object" ? baseRuns : {})
  };

  Object.entries(nextRuns && typeof nextRuns === "object" ? nextRuns : {}).forEach(([monthKey, runs]) => {
    merged[monthKey] = Math.max(Number(merged[monthKey] || 0), Number(runs || 0));
  });

  return merged;
}

function aggregateAttendance(logs) {
  const result = new Map();

  logs.forEach((log) => {
    const monthKey = toMonthKey(log?.attendance_date);
    const matched = Array.isArray(log?.matched) ? log.matched : [];
    matched.forEach((name) => {
      const normalized = normalizeName(name);
      if (!normalized) {
        return;
      }
      const memberRuns = result.get(normalized) || {};
      memberRuns[monthKey] = Number(memberRuns[monthKey] || 0) + 1;
      result.set(normalized, memberRuns);
    });
  });

  return result;
}

async function loadCurrentMembers() {
  const attempts = [
    `${MEMBER_TABLE}?select=name,birth_year,total_runs,monthly_runs,fee_status,aliases&limit=500`,
    `${MEMBER_TABLE}?select=name,birth_year,total_runs,monthly_runs,fee_status&limit=500`,
    `${MEMBER_TABLE}?select=name,birth_year,total_runs,monthly_runs&limit=500`
  ];

  for (const path of attempts) {
    try {
      return await supabaseSelect(path);
    } catch (error) {
      const message = String(error?.message || error || "");
      const known = message.includes("fee_status") || message.includes("aliases");
      if (!known) {
        throw error;
      }
    }
  }

  return [];
}

async function replaceMembers(rows) {
  await supabaseDeleteAll(MEMBER_TABLE);
  await supabaseInsert(MEMBER_TABLE, rows);
}

async function tryInsertOperationLog(auth, count) {
  try {
    await supabaseInsert(LOG_TABLE, {
      actor_user_id: auth.user?.id || null,
      actor_name: String(auth.user?.email || "admin").slice(0, 120),
      action: "회원 목록 복구",
      detail: `승인 프로필 기준 ${count}명 복구`
    });
  } catch (error) {
    const message = String(error?.message || error || "");
    const missingLogTable = message.includes("operation_logs") && message.includes("schema cache");
    if (!missingLogTable) {
      throw error;
    }
  }
}

function buildMemberKey(name, birthYear) {
  return `${normalizeName(name)}|${Number(birthYear || 0)}`;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function toMonthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(num)));
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

async function supabaseDeleteAll(table) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
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
