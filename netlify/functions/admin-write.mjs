const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";
const ATTENDANCE_RPC_NAME = "admin_attendance_mutation";

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "add_notice") {
      const title = String(body?.title || "").trim();
      const content = String(body?.content || "").trim();
      if (!title || !content) {
        return json(400, { ok: false, error: "missing title or content" });
      }

      await supabaseInsert("notices", {
        title: title.slice(0, 120),
        content: content.slice(0, 4000)
      });
      await tryInsertOperationLog(auth, "notice_add", title.slice(0, 120));
      return json(200, { ok: true, message: "notice added" });
    }

    if (action === "update_notice") {
      const noticeId = String(body?.notice_id || "").trim();
      const title = String(body?.title || "").trim();
      const content = String(body?.content || "").trim();
      if (!noticeId || !title || !content) {
        return json(400, { ok: false, error: "missing notice payload" });
      }

      await supabasePatch(`notices?id=eq.${encodeURIComponent(noticeId)}`, {
        title: title.slice(0, 120),
        content: content.slice(0, 4000)
      });
      await tryInsertOperationLog(auth, "notice_update", title.slice(0, 120));
      return json(200, { ok: true, message: "notice updated" });
    }

    if (action === "delete_notice") {
      const noticeId = String(body?.notice_id || "").trim();
      if (!noticeId) {
        return json(400, { ok: false, error: "missing notice_id" });
      }

      await supabaseDelete(`notices?id=eq.${encodeURIComponent(noticeId)}`);
      await tryInsertOperationLog(auth, "notice_delete", noticeId);
      return json(200, { ok: true, message: "notice deleted" });
    }

    if (action === "update_guest_status") {
      const guestId = String(body?.guest_id || "").trim();
      const status = String(body?.status || "").trim();
      if (!guestId || !status) {
        return json(400, { ok: false, error: "missing guest payload" });
      }

      await supabasePatch(`guests?id=eq.${encodeURIComponent(guestId)}`, {
        status: status.slice(0, 20)
      });
      await tryInsertOperationLog(auth, "guest_status_update", `${guestId}:${status}`);
      return json(200, { ok: true, message: "guest updated" });
    }

    if (action === "delete_guest") {
      const guestId = String(body?.guest_id || "").trim();
      if (!guestId) {
        return json(400, { ok: false, error: "missing guest_id" });
      }

      await supabaseDelete(`guests?id=eq.${encodeURIComponent(guestId)}`);
      await tryInsertOperationLog(auth, "guest_delete", guestId);
      return json(200, { ok: true, message: "guest deleted" });
    }

    if (action === "add_member") {
      const name = String(body?.name || "").trim();
      const birthYear = Number(body?.birth_year || 0);
      if (!name) {
        return json(400, { ok: false, error: "missing name" });
      }
      if (birthYear < 1989 || birthYear > 2000) {
        return json(400, { ok: false, error: "invalid birth_year" });
      }

      const existingMembers = await loadMembers();
      const normalizedName = normalizeName(name);
      const duplicate = existingMembers.find((member) => {
        const sameName = normalizeName(member.name) === normalizedName;
        const sameBirthYear = Number(member.birth_year || 0) === birthYear;
        return sameName && sameBirthYear;
      });
      if (duplicate) {
        return json(409, { ok: false, error: "member already exists" });
      }

      await supabaseInsert("members", {
        name: name.slice(0, 80),
        birth_year: birthYear,
        total_runs: 0,
        monthly_runs: {},
        fee_status: {},
        aliases: [],
        is_active: true
      });
      await tryInsertOperationLog(auth, "member_add", `${name} (${birthYear})`);
      return json(200, { ok: true, message: "member added" });
    }

    if (action === "update_member") {
      const memberId = String(body?.member_id || "").trim();
      const name = String(body?.name || "").trim();
      const birthYear = Number(body?.birth_year || 0);
      if (!memberId || !name) {
        return json(400, { ok: false, error: "missing member payload" });
      }
      if (birthYear < 1989 || birthYear > 2000) {
        return json(400, { ok: false, error: "invalid birth_year" });
      }

      const existingMembers = await loadMembers();
      const normalizedName = normalizeName(name);
      const duplicate = existingMembers.find((member) => {
        if (String(member.id) === memberId) {
          return false;
        }
        const sameName = normalizeName(member.name) === normalizedName;
        const sameBirthYear = Number(member.birth_year || 0) === birthYear;
        return sameName && sameBirthYear;
      });
      if (duplicate) {
        return json(409, { ok: false, error: "member already exists" });
      }

      await supabasePatch(`members?id=eq.${encodeURIComponent(memberId)}`, {
        name: name.slice(0, 80),
        birth_year: birthYear
      });
      await tryInsertOperationLog(auth, "member_update", `${name} (${birthYear})`);
      return json(200, { ok: true, message: "member updated" });
    }

    if (action === "toggle_member_active") {
      const memberId = String(body?.member_id || "").trim();
      const isActive = Boolean(body?.is_active);
      if (!memberId) {
        return json(400, { ok: false, error: "missing member_id" });
      }

      await supabasePatch(`members?id=eq.${encodeURIComponent(memberId)}`, {
        is_active: isActive
      });
      await tryInsertOperationLog(auth, isActive ? "member_activate" : "member_deactivate", memberId);
      return json(200, { ok: true, message: "member active status updated" });
    }

    if (action === "update_member_fee_status") {
      const memberId = String(body?.member_id || "").trim();
      const monthKey = String(body?.month_key || "").trim();
      const status = String(body?.status || "").trim();
      if (!memberId || !monthKey || !["paid", "unpaid"].includes(status)) {
        return json(400, { ok: false, error: "invalid fee payload" });
      }

      const member = await loadMemberById(memberId);
      if (!member) {
        return json(404, { ok: false, error: "member not found" });
      }

      const feeStatus = member?.fee_status && typeof member.fee_status === "object"
        ? member.fee_status
        : {};

      await supabasePatch(`members?id=eq.${encodeURIComponent(memberId)}`, {
        fee_status: { ...feeStatus, [monthKey]: status }
      });
      await tryInsertOperationLog(auth, "fee_status_update", `${member.name} ${monthKey}:${status}`);
      return json(200, { ok: true, message: "member fee updated" });
    }

    if (action === "reset_month_fees") {
      const monthKey = String(body?.month_key || "").trim();
      if (!monthKey) {
        return json(400, { ok: false, error: "missing month_key" });
      }

      const members = await loadMembers();
      for (const member of members) {
        const feeStatus = member?.fee_status && typeof member.fee_status === "object"
          ? member.fee_status
          : {};
        await supabasePatch(`members?id=eq.${encodeURIComponent(member.id)}`, {
          fee_status: { ...feeStatus, [monthKey]: "unpaid" }
        });
      }
      await tryInsertOperationLog(auth, "fee_status_reset", monthKey);
      return json(200, { ok: true, message: "month fees reset" });
    }

    if (action === "apply_attendance") {
      const names = parseNames(body?.names);
      const attendanceDate = String(body?.date || "").trim();
      const eventType = String(body?.event_type || "정기런").trim() || "정기런";
      const source = String(body?.source || "bulk").trim() || "bulk";

      if (!names.length) {
        return json(400, { ok: false, error: "missing names" });
      }
      if (!attendanceDate) {
        return json(400, { ok: false, error: "missing date" });
      }

      const rpcResult = await tryAttendanceMutationRpc({
        action,
        names,
        date: attendanceDate,
        event_type: eventType,
        source
      });
      if (rpcResult) {
        await tryInsertOperationLog(auth, "attendance_apply", `${attendanceDate} ${eventType}`);
        return json(200, rpcResult);
      }

      return json(200, await applyAttendanceFallback(auth, { names, attendanceDate, eventType, source }));
    }

    if (action === "replace_attendance_log") {
      const logId = String(body?.log_id || "").trim();
      const names = parseNames(body?.names);
      if (!logId || !names.length) {
        return json(400, { ok: false, error: "missing attendance payload" });
      }

      const existingLog = await loadAttendanceLogById(logId);
      if (!existingLog) {
        return json(404, { ok: false, error: "attendance log not found" });
      }

      const attendanceDate = String(body?.date || existingLog.attendance_date || "").trim();
      const eventType = String(body?.event_type || existingLog.event_type || "정기런").trim() || "정기런";
      const source = String(body?.source || existingLog.source || "bulk").trim() || "bulk";
      if (!attendanceDate) {
        return json(400, { ok: false, error: "missing date" });
      }

      const rpcResult = await tryAttendanceMutationRpc({
        action,
        log_id: logId,
        names,
        date: attendanceDate,
        event_type: eventType,
        source
      });
      if (rpcResult) {
        await tryInsertOperationLog(auth, "attendance_replace", `${attendanceDate} ${eventType}`);
        return json(200, rpcResult);
      }

      return json(200, await replaceAttendanceFallback(auth, {
        logId,
        names,
        attendanceDate,
        eventType,
        source
      }));
    }

    if (action === "revert_attendance_log") {
      const logId = String(body?.log_id || "").trim();
      if (!logId) {
        return json(400, { ok: false, error: "missing log_id" });
      }

      const rpcResult = await tryAttendanceMutationRpc({
        action,
        log_id: logId
      });
      if (rpcResult) {
        await tryInsertOperationLog(auth, "attendance_revert", logId);
        return json(200, rpcResult);
      }

      return json(200, await revertAttendanceFallback(auth, { logId }));
    }

    if (action === "adjust_member_attendance") {
      const memberId = String(body?.member_id || "").trim();
      const attendanceDate = String(body?.date || "").trim();
      const delta = Number(body?.delta || 0);
      if (!memberId || !attendanceDate || ![-1, 1].includes(delta)) {
        return json(400, { ok: false, error: "invalid payload" });
      }

      const rpcResult = await tryAttendanceMutationRpc({
        action,
        member_id: memberId,
        date: attendanceDate,
        delta
      });
      if (rpcResult) {
        await tryInsertOperationLog(auth, delta > 0 ? "attendance_add" : "attendance_subtract", `${memberId} ${attendanceDate}`);
        return json(200, rpcResult);
      }

      const member = await loadMemberById(memberId);
      if (!member) {
        return json(404, { ok: false, error: "member not found" });
      }

      const monthKey = monthKeyFromDate(attendanceDate);
      await updateMemberRuns(member, delta, monthKey);
      await tryInsertOperationLog(auth, delta > 0 ? "attendance_add" : "attendance_subtract", `${member.name} ${attendanceDate}`);
      return json(200, { ok: true, message: "attendance adjusted" });
    }

    return json(400, { ok: false, error: "invalid action" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function applyAttendanceFallback(auth, { names, attendanceDate, eventType, source }) {
  const members = await loadMembers();
  const uniqueNames = dedupeNormalized(names);
  const monthKey = monthKeyFromDate(attendanceDate);
  const existingLogs = await loadAttendanceLogs();
  const existingLog = findAttendanceLogByScope(existingLogs, attendanceDate, eventType, source);

  if (existingLog) {
    await revertAttendanceMatches(existingLog, members, monthKey);
    await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(existingLog.id)}`);
  }

  const summary = await createAttendanceLogRecord({ names, uniqueNames, members, attendanceDate, eventType, source, monthKey });
  await tryInsertOperationLog(auth, "attendance_apply", `${attendanceDate} ${eventType} / ${summary.summary.matched.length}`);
  return summary;
}

async function replaceAttendanceFallback(auth, { logId, names, attendanceDate, eventType, source }) {
  const existingLog = await loadAttendanceLogById(logId);
  if (!existingLog) {
    throw new Error("attendance log not found");
  }

  const members = await loadMembers();
  const uniqueNames = dedupeNormalized(names);
  const monthKey = monthKeyFromDate(attendanceDate);
  const existingLogs = await loadAttendanceLogs();
  const conflictingLog = existingLogs.find((entry) => (
    String(entry?.id || "") !== String(logId)
    && String(entry?.attendance_date || "") === attendanceDate
    && String(entry?.event_type || "") === eventType
    && String(entry?.source || "bulk") === source
  )) || null;

  await revertAttendanceMatches(existingLog, members, monthKeyFromDate(existingLog.attendance_date));
  await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(existingLog.id)}`);

  if (conflictingLog) {
    await revertAttendanceMatches(conflictingLog, members, monthKeyFromDate(conflictingLog.attendance_date));
    await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(conflictingLog.id)}`);
  }

  const summary = await createAttendanceLogRecord({ names, uniqueNames, members, attendanceDate, eventType, source, monthKey });
  summary.summary.replaced_existing = true;
  await tryInsertOperationLog(auth, "attendance_replace", `${attendanceDate} ${eventType} / ${summary.summary.matched.length}`);
  return summary;
}

async function revertAttendanceFallback(auth, { logId }) {
  const log = await loadAttendanceLogById(logId);
  if (!log) {
    throw new Error("attendance log not found");
  }

  const members = await loadMembers();
  await revertAttendanceMatches(log, members, monthKeyFromDate(log.attendance_date));
  await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(log.id)}`);
  await tryInsertOperationLog(auth, "attendance_revert", `${log.attendance_date} ${log.event_type}`);
  return { ok: true, message: "attendance reverted" };
}

async function createAttendanceLogRecord({ names, uniqueNames, members, attendanceDate, eventType, source, monthKey }) {
  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  for (const inputName of uniqueNames) {
    const result = findMemberByName(inputName, members);
    if (result.type === "unique") {
      await updateMemberRuns(result.member, 1, monthKey);
      matched.push(result.member.name);
      continue;
    }
    if (result.type === "ambiguous") {
      ambiguous.push(inputName);
      continue;
    }
    unmatched.push(inputName);
  }

  await supabaseInsert("attendance_logs", {
    source: source.slice(0, 20),
    event_type: eventType.slice(0, 20),
    attendance_date: attendanceDate,
    raw_count: names.length,
    matched,
    unmatched,
    ambiguous,
    created_at: new Date().toISOString()
  });

  return {
    ok: true,
    summary: {
      matched,
      unmatched,
      ambiguous,
      replaced_existing: false
    }
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

  const profiles = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status,name&limit=1`);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";

  return { ok: Boolean(isAdmin), user, profile };
}

async function loadMembers() {
  const attempts = [
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active&order=name.asc&limit=500",
    "members?select=id,name,birth_year,total_runs,monthly_runs,fee_status,is_active&order=name.asc&limit=500",
    "members?select=id,name,birth_year,total_runs,monthly_runs,is_active&order=name.asc&limit=500"
  ];

  for (const path of attempts) {
    try {
      return await supabaseSelect(path);
    } catch (error) {
      if (!isMissingColumnError(error, "aliases") && !isMissingColumnError(error, "fee_status")) {
        throw error;
      }
    }
  }

  return [];
}

async function loadMemberById(memberId) {
  const attempts = [
    `members?id=eq.${encodeURIComponent(memberId)}&select=id,name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active&limit=1`,
    `members?id=eq.${encodeURIComponent(memberId)}&select=id,name,birth_year,total_runs,monthly_runs,fee_status,is_active&limit=1`,
    `members?id=eq.${encodeURIComponent(memberId)}&select=id,name,birth_year,total_runs,monthly_runs,is_active&limit=1`
  ];

  for (const path of attempts) {
    try {
      const rows = await supabaseSelect(path);
      return Array.isArray(rows) ? rows[0] || null : null;
    } catch (error) {
      if (!isMissingColumnError(error, "aliases") && !isMissingColumnError(error, "fee_status")) {
        throw error;
      }
    }
  }

  return null;
}

async function loadAttendanceLogs() {
  return supabaseSelect("attendance_logs?select=id,source,event_type,attendance_date,matched,unmatched,ambiguous,created_at&order=created_at.desc&limit=200");
}

async function loadAttendanceLogById(logId) {
  const rows = await supabaseSelect(`attendance_logs?id=eq.${encodeURIComponent(logId)}&select=id,source,event_type,attendance_date,matched,unmatched,ambiguous,created_at&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function parseNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

function dedupeNormalized(names) {
  const map = new Map();
  names.forEach((name) => {
    const key = normalizeName(name);
    if (!map.has(key)) {
      map.set(key, name);
    }
  });
  return Array.from(map.values());
}

function findMemberByName(inputName, members) {
  const normalized = normalizeName(inputName);
  const exactMatches = members.filter((member) => {
    if (normalizeName(member.name) === normalized) {
      return true;
    }
    return Array.isArray(member.aliases) && member.aliases.some((alias) => normalizeName(alias) === normalized);
  });

  if (exactMatches.length === 1) {
    return { type: "unique", member: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { type: "ambiguous" };
  }

  const partialMatches = members.filter((member) => {
    const name = normalizeName(member.name);
    return name.includes(normalized) || normalized.includes(name);
  });

  if (partialMatches.length === 1) {
    return { type: "unique", member: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { type: "ambiguous" };
  }

  return { type: "not_found" };
}

function findAttendanceLogByScope(logs, attendanceDate, eventType, source) {
  return (Array.isArray(logs) ? logs : []).find((entry) => (
    String(entry?.attendance_date || "") === String(attendanceDate || "")
    && String(entry?.event_type || "") === String(eventType || "")
    && String(entry?.source || "bulk") === String(source || "bulk")
  )) || null;
}

async function revertAttendanceMatches(log, members, monthKey) {
  const matchedNames = Array.isArray(log?.matched) ? log.matched : [];
  for (const matchedName of matchedNames) {
    const result = findMemberByName(matchedName, members);
    if (result.type === "unique") {
      await updateMemberRuns(result.member, -1, monthKey);
    }
  }
}

async function updateMemberRuns(member, delta, monthKey) {
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object"
    ? member.monthly_runs
    : {};
  const nextTotal = Math.max(0, Number(member?.total_runs || 0) + delta);
  const currentMonthly = Number(monthlyRuns[monthKey] || 0);
  const nextMonthly = Math.max(0, currentMonthly + delta);
  await supabasePatch(`members?id=eq.${encodeURIComponent(member.id)}`, {
    total_runs: nextTotal,
    monthly_runs: { ...monthlyRuns, [monthKey]: nextMonthly }
  });
  member.total_runs = nextTotal;
  member.monthly_runs = { ...monthlyRuns, [monthKey]: nextMonthly };
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function monthKeyFromDate(dateText) {
  const dt = new Date(dateText);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

async function supabaseDelete(path) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
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

async function supabaseRpc(name, payload) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
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

  return response.json();
}

async function tryAttendanceMutationRpc(payload) {
  try {
    const result = await supabaseRpc(ATTENDANCE_RPC_NAME, { payload });
    return result && typeof result === "object" ? result : null;
  } catch (error) {
    if (isMissingFunctionError(error, ATTENDANCE_RPC_NAME)) {
      return null;
    }
    throw error;
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

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(String(columnName || "").toLowerCase()) && message.includes("does not exist");
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(String(tableName || "").toLowerCase()) && (message.includes("could not find the table") || message.includes("schema cache"));
}

function isMissingFunctionError(error, functionName) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes(String(functionName || "").toLowerCase()) && (message.includes("function") || message.includes("could not find"));
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
