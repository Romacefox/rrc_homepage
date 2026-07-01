const PROFILE_TABLE = "member_profiles";
const MEMBER_TABLE = "members";
const ATTENDANCE_TABLE = "attendance_logs";
const AWARD_TABLE = "member_point_awards";
const LOG_TABLE = "operation_logs";

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "운영진 권한이 필요합니다." });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const monthKey = normalizeMonthKey(url.searchParams.get("month")) || currentMonthKey();
      return json(200, await buildHealthcheck(monthKey));
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const action = String(body?.action || "").trim();
      const monthKey = normalizeMonthKey(body?.month_key) || currentMonthKey();
      const confirmed = body?.confirmed === true;

      if (action === "recalc_monthly_attendance") {
        const result = await recalcMonthlyAttendance(monthKey, confirmed, auth);
        return json(200, result);
      }
      if (action === "grant_missing_welcome_points") {
        const result = await grantMissingWelcomePoints(confirmed, auth);
        return json(200, result);
      }
      if (action === "repair_missing_member_profile") {
        const result = await repairMissingMemberProfile(body, confirmed, auth);
        return json(200, result);
      }
      return json(400, { ok: false, error: "invalid action" });
    }

    return json(405, { ok: false, error: "method not allowed" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function buildHealthcheck(monthKey) {
  const [authUsers, members, profiles, attendanceLogs, pointAwards, operationLogs] = await Promise.all([
    listAuthUsers(),
    loadMembers(),
    supabaseSelect(`${PROFILE_TABLE}?select=user_id,email,name,birth_year,approval_status,role,created_at&limit=1000`).catch(() => []),
    loadAttendanceLogs(),
    supabaseSelect(`${AWARD_TABLE}?select=id,user_id,member_name,month_key,award_code,points,created_at&limit=2000`).catch(() => []),
    supabaseSelect(`${LOG_TABLE}?select=id,actor_name,action,detail,created_at&order=created_at.desc&limit=100`).catch(() => [])
  ]);

  const profileRows = Array.isArray(profiles) ? profiles : [];
  const memberRows = Array.isArray(members) ? members : [];
  const authRows = Array.isArray(authUsers) ? authUsers : [];
  const pendingProfiles = profileRows.filter((row) => row.approval_status === "pending");
  const approvedProfiles = profileRows.filter((row) => row.approval_status === "approved");
  const rejectedProfiles = profileRows.filter((row) => row.approval_status === "rejected");
  const authWithoutProfile = authRows.filter((user) => !profileRows.some((profile) => String(profile.user_id) === String(user.id)));
  const authWithoutMember = authRows.filter((user) => {
    const profile = profileRows.find((row) => String(row.user_id) === String(user.id));
    return !profile || !findMemberByProfile(profile, memberRows);
  });
  const memberWithoutProfile = memberRows.filter((member) => !profileRows.some((profile) => profileMatchesMember(profile, member)));
  const currentMonthLogs = (Array.isArray(attendanceLogs) ? attendanceLogs : []).filter((log) => toMonthKey(log.attendance_date) === monthKey);
  const duplicateAttendance = findDuplicateAttendanceScopes(attendanceLogs);
  const inactiveAttendance = findInactiveAttendance(currentMonthLogs, memberRows);
  const monthlyMismatches = calculateMonthlyAttendanceMismatches(monthKey, memberRows, attendanceLogs);
  const duplicateAwards = findDuplicateGroups(pointAwards, (row) => `${row.user_id || normalizeName(row.member_name)}|${row.month_key}|${row.award_code}`);
  const missingWelcome = approvedProfiles.filter((profile) => !hasSignupBonus(profile, pointAwards));

  return {
    ok: true,
    month_key: monthKey,
    signup: {
      auth_user_count: authRows.length,
      members_row_count: memberRows.length,
      pending_count: pendingProfiles.length,
      approved_count: approvedProfiles.length,
      rejected_count: rejectedProfiles.length,
      auth_without_member_count: authWithoutMember.length,
      member_without_user_id_count: memberWithoutProfile.length,
      auth_without_profile_count: authWithoutProfile.length
    },
    pending_members: pendingProfiles.slice(0, 30).map((profile) => ({
      user_id: profile.user_id,
      name: profile.name || "",
      email_masked: maskEmail(profile.email),
      email_confirmed: isAuthEmailConfirmed(profile.user_id, authRows),
      created_at: profile.created_at || null
    })),
    attendance: {
      month_log_count: currentMonthLogs.length,
      recent_date: findRecentAttendanceDate(attendanceLogs),
      duplicate_scope_count: duplicateAttendance.length,
      unmatched_name_count: currentMonthLogs.reduce((sum, log) => sum + (Array.isArray(log.unmatched) ? log.unmatched.length : 0), 0),
      inactive_attendance_count: inactiveAttendance.length,
      duplicate_scopes: duplicateAttendance.slice(0, 20),
      inactive_rows: inactiveAttendance.slice(0, 20)
    },
    monthly_summary: {
      mismatch_count: monthlyMismatches.length,
      rows: monthlyMismatches.slice(0, 50)
    },
    points: {
      duplicate_award_count: duplicateAwards.length,
      missing_welcome_points_count: missingWelcome.length,
      total_points_mismatch_count: 0,
      total_points_note: "members.total_points 컬럼이 없어 원장 합계 비교는 현재 적용되지 않습니다.",
      duplicate_awards: duplicateAwards.slice(0, 20),
      missing_welcome_profiles: missingWelcome.slice(0, 30).map((profile) => ({
        user_id: profile.user_id,
        name: profile.name || "",
        email_masked: maskEmail(profile.email)
      }))
    },
    operation_logs: (Array.isArray(operationLogs) ? operationLogs : []).slice(0, 20),
    notes: [
      "현재 attendance_logs는 날짜/유형별 명단 JSON 구조라 member_id 없는 출석은 unmatched 이름 수로 점검합니다.",
      "members 테이블에는 user_id 컬럼이 없어 member_profiles의 이름/출생연도와 매칭해 연결 의심 건수를 계산합니다."
    ]
  };
}

async function recalcMonthlyAttendance(monthKey, confirmed, auth) {
  const [members, logs] = await Promise.all([loadMembers(), loadAttendanceLogs()]);
  const rows = calculateMonthlyAttendanceMismatches(monthKey, members, logs);
  if (!confirmed) {
    return { ok: true, preview: true, month_key: monthKey, mismatch_count: rows.length, rows };
  }

  for (const row of rows) {
    const member = members.find((item) => String(item.id) === String(row.member_id));
    if (!member) {
      continue;
    }
    const monthlyRuns = member.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {};
    await supabasePatch(`${MEMBER_TABLE}?id=eq.${encodeURIComponent(member.id)}`, {
      monthly_runs: { ...monthlyRuns, [monthKey]: row.attendance_count },
      total_runs: recalcTotalRuns({ ...monthlyRuns, [monthKey]: row.attendance_count })
    });
  }
  await tryInsertOperationLog(auth, "healthcheck_recalc_monthly_attendance", {
    month_key: monthKey,
    updated_count: rows.length
  });
  return { ok: true, preview: false, month_key: monthKey, updated_count: rows.length, rows };
}

async function grantMissingWelcomePoints(confirmed, auth) {
  const [profiles, awards] = await Promise.all([
    supabaseSelect(`${PROFILE_TABLE}?approval_status=eq.approved&select=user_id,email,name&limit=1000`),
    supabaseSelect(`${AWARD_TABLE}?award_code=eq.signup_bonus&select=user_id,award_code&limit=2000`).catch(() => [])
  ]);
  const missing = (Array.isArray(profiles) ? profiles : []).filter((profile) => !hasSignupBonus(profile, awards));
  if (!confirmed) {
    return {
      ok: true,
      preview: true,
      missing_count: missing.length,
      rows: missing.slice(0, 50).map((profile) => ({ user_id: profile.user_id, name: profile.name || "", email_masked: maskEmail(profile.email) }))
    };
  }
  for (const profile of missing) {
    await supabaseInsert(AWARD_TABLE, {
      user_id: profile.user_id,
      member_name: String(profile.name || profile.email || "회원").slice(0, 80),
      month_key: currentMonthKey(),
      award_code: "signup_bonus",
      award_label: "신규 가입 웰컴 포인트",
      points: 20,
      note: "시스템 점검에서 누락 웰컴 포인트 보정",
      granted_by_user_id: auth.user?.id || null,
      granted_by_name: String(auth.user?.email || "admin").slice(0, 120)
    });
  }
  await tryInsertOperationLog(auth, "healthcheck_grant_missing_welcome_points", { granted_count: missing.length });
  return { ok: true, preview: false, granted_count: missing.length };
}

async function repairMissingMemberProfile(body, confirmed, auth) {
  const userId = String(body?.user_id || "").trim();
  if (!userId) {
    return { ok: false, error: "missing user_id" };
  }
  const authUser = await loadAuthUser(userId);
  if (!authUser?.id) {
    return { ok: false, error: "Auth 사용자를 찾을 수 없습니다." };
  }
  const existing = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);
  if (Array.isArray(existing) && existing.length) {
    return { ok: true, preview: !confirmed, repaired: false, message: "이미 프로필이 있습니다." };
  }
  const meta = authUser.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : {};
  const profile = {
    user_id: authUser.id,
    email: String(authUser.email || "").toLowerCase(),
    name: String(meta.name || body?.name || "").trim(),
    birth_year: Number(meta.birth_year || body?.birth_year || 0),
    intro: String(meta.intro || "").trim(),
    role: "member",
    approval_status: "pending"
  };
  if (!profile.name || !profile.birth_year) {
    return { ok: false, error: "복구에 필요한 이름/출생연도 metadata가 부족합니다." };
  }
  if (!confirmed) {
    return { ok: true, preview: true, profile: { ...profile, email: maskEmail(profile.email) } };
  }
  await supabaseInsert(PROFILE_TABLE, profile);
  await tryInsertOperationLog(auth, "healthcheck_repair_missing_member_profile", { user_id: userId, email: maskEmail(profile.email) });
  return { ok: true, preview: false, repaired: true, profile: { ...profile, email: maskEmail(profile.email) } };
}

function calculateMonthlyAttendanceMismatches(monthKey, members, logs) {
  const counts = new Map();
  (Array.isArray(logs) ? logs : []).forEach((log) => {
    if (toMonthKey(log.attendance_date) !== monthKey) {
      return;
    }
    (Array.isArray(log.matched) ? log.matched : []).forEach((name) => {
      const key = normalizeName(name);
      counts.set(key, Number(counts.get(key) || 0) + 1);
    });
  });
  return (Array.isArray(members) ? members : []).map((member) => {
    const key = normalizeName(member.name);
    const monthlyRuns = member.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {};
    const attendanceCount = Number(counts.get(key) || 0);
    const summaryCount = Number(monthlyRuns[monthKey] || 0);
    return {
      member_id: member.id,
      name: member.name,
      birth_year: member.birth_year,
      attendance_count: attendanceCount,
      monthly_runs_count: summaryCount,
      delta: attendanceCount - summaryCount
    };
  }).filter((row) => row.delta !== 0);
}

function findDuplicateAttendanceScopes(logs) {
  return findDuplicateGroups(logs, (log) => `${log.attendance_date}|${log.event_type}`)
    .map((item) => ({ scope: item.key, count: item.count }));
}

function findInactiveAttendance(logs, members) {
  const inactiveByName = new Map((Array.isArray(members) ? members : [])
    .filter((member) => member.is_active === false)
    .map((member) => [normalizeName(member.name), member]));
  const rows = [];
  (Array.isArray(logs) ? logs : []).forEach((log) => {
    (Array.isArray(log.matched) ? log.matched : []).forEach((name) => {
      const member = inactiveByName.get(normalizeName(name));
      if (member) {
        rows.push({ date: log.attendance_date, event_type: log.event_type, name: member.name });
      }
    });
  });
  return rows;
}

function findDuplicateGroups(rows, buildKey) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = buildKey(row);
    if (!key || key.includes("undefined")) {
      return;
    }
    const entry = map.get(key) || { key, count: 0, rows: [] };
    entry.count += 1;
    entry.rows.push(row);
    map.set(key, entry);
  });
  return Array.from(map.values()).filter((entry) => entry.count > 1);
}

function hasSignupBonus(profile, awards) {
  return (Array.isArray(awards) ? awards : []).some((award) => (
    String(award.user_id || "") === String(profile.user_id || "")
    && award.award_code === "signup_bonus"
  ));
}

function isAuthEmailConfirmed(userId, authUsers) {
  const user = (Array.isArray(authUsers) ? authUsers : []).find((item) => String(item.id) === String(userId));
  return user ? Boolean(user.email_confirmed_at || user.confirmed_at) : null;
}

function findMemberByProfile(profile, members) {
  return (Array.isArray(members) ? members : []).find((member) => profileMatchesMember(profile, member)) || null;
}

function profileMatchesMember(profile, member) {
  return normalizeName(profile?.name) === normalizeName(member?.name)
    && Number(profile?.birth_year || 0) === Number(member?.birth_year || 0);
}

function findRecentAttendanceDate(logs) {
  return (Array.isArray(logs) ? logs : [])
    .map((log) => String(log.attendance_date || ""))
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function recalcTotalRuns(monthlyRuns) {
  return Object.values(monthlyRuns && typeof monthlyRuns === "object" ? monthlyRuns : {})
    .reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
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
  const rows = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status&limit=1`);
  const profile = Array.isArray(rows) ? rows[0] || null : null;
  return { ok: profile?.role === "admin" && profile?.approval_status === "approved", user, profile };
}

async function loadMembers() {
  const attempts = [
    `${MEMBER_TABLE}?select=id,name,birth_year,total_runs,monthly_runs,aliases,is_active&order=name.asc&limit=1000`,
    `${MEMBER_TABLE}?select=id,name,birth_year,total_runs,monthly_runs,is_active&order=name.asc&limit=1000`
  ];
  for (const path of attempts) {
    try {
      return await supabaseSelect(path);
    } catch (error) {
      if (!String(error?.message || error).includes("aliases")) {
        throw error;
      }
    }
  }
  return [];
}

function loadAttendanceLogs() {
  return supabaseSelect(`${ATTENDANCE_TABLE}?select=id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at&order=attendance_date.desc&limit=2000`);
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

async function tryInsertOperationLog(auth, action, metadata) {
  try {
    await supabaseInsert(LOG_TABLE, {
      actor_user_id: auth.user?.id || null,
      actor_name: String(auth.user?.email || "admin").slice(0, 120),
      action,
      detail: JSON.stringify(metadata).slice(0, 4000)
    });
  } catch (error) {
    if (!String(error?.message || error).includes(LOG_TABLE)) {
      throw error;
    }
  }
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

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) {
    return "";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function normalizeMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function extractBearerToken(header) {
  const [type, token] = String(header || "").split(" ");
  if ((type || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
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
