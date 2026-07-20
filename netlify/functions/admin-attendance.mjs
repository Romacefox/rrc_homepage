const PROFILE_TABLE = "member_profiles";
const MEMBER_TABLE = "members";
const ATTENDANCE_TABLE = "attendance_logs";
const LOG_TABLE = "operation_logs";
const VALID_MODES = new Set(["append", "replace"]);

export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "운영진 권한이 필요합니다." });
    }
    if (request.method !== "POST") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "preview").trim();
    if (action === "preview") {
      return json(200, await previewAttendance(body, auth));
    }
    if (action === "commit") {
      return json(200, await commitAttendance(body, auth));
    }
    return json(400, { ok: false, error: "invalid action" });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function previewAttendance(body, auth = null) {
  const input = normalizeInput(body);
  const members = await loadMembers();
  const profiles = await loadProfiles();
  const logs = await loadAttendanceLogs();
  const scopeLogs = findAttendanceLogsByScope(logs, input.date, input.eventType);
  const existingNames = uniqueNames(scopeLogs.flatMap((log) => Array.isArray(log?.matched) ? log.matched : []));
  const existingKeys = new Set(existingNames.map(normalizeName));
  const parsedNames = parseNames(input.namesText);
  const seenInputKeys = new Set();
  const acceptedInputKeys = new Set();
  const rows = [];

  parsedNames.forEach((name, index) => {
    const key = normalizeName(name);
    if (!key) {
      return;
    }
    if (seenInputKeys.has(key)) {
      rows.push(buildRow({ inputName: name, status: "duplicate_input", message: "입력 명단 안에서 중복되어 제외됩니다.", index }));
      return;
    }
    seenInputKeys.add(key);

    const match = findMemberByName(name, members);
    if (match.type === "ambiguous") {
      rows.push(buildRow({ inputName: name, status: "ambiguous_name", message: "동명이인 또는 후보가 여러 명입니다. 수동 확인이 필요합니다.", candidates: match.candidates, index }));
      return;
    }
    if (match.type !== "unique") {
      rows.push(buildRow({ inputName: name, status: "not_found", message: "회원 목록에서 찾을 수 없습니다.", index }));
      return;
    }

    const member = match.member;
    const profileStatus = findProfileStatus(member, profiles);
    if (profileStatus && profileStatus !== "approved") {
      rows.push(buildRow({ inputName: name, member, status: "not_approved", message: "승인되지 않은 회원으로 확인되어 자동 반영하지 않습니다.", index }));
      return;
    }
    if (member.is_active === false) {
      rows.push(buildRow({ inputName: name, member, status: "inactive", message: "휴면 회원입니다. 필요하면 회원 상태를 먼저 확인해 주세요.", index }));
      return;
    }

    const memberKey = normalizeName(member.name);
    acceptedInputKeys.add(memberKey);
    if (existingKeys.has(memberKey)) {
      rows.push(buildRow({
        inputName: name,
        member,
        status: input.mode === "replace" ? "unchanged" : "already_attended",
        message: input.mode === "replace" ? "기존 출석을 유지합니다." : "이미 입력된 출석이라 중복 저장하지 않습니다.",
        index
      }));
      return;
    }

    rows.push(buildRow({ inputName: name, member, status: "will_add", message: "저장 시 출석으로 추가됩니다.", index }));
  });

  if (input.mode === "replace") {
    existingNames.forEach((existingName, index) => {
      const key = normalizeName(existingName);
      if (!acceptedInputKeys.has(key)) {
        const match = findMemberByName(existingName, members);
        rows.push(buildRow({
          inputName: existingName,
          member: match.type === "unique" ? match.member : null,
          status: "will_remove",
          message: "전체 교체 시 기존 출석에서 제거됩니다.",
          index: parsedNames.length + index
        }));
      }
    });
  }

  const summary = summarizeRows(rows, parsedNames.length);
  if (auth) {
    await tryInsertOperationLog(auth, "attendance_preview", {
      date: input.date,
      run_type: input.eventType,
      mode: input.mode,
      input_count: parsedNames.length,
      added_count: summary.will_add_count,
      skipped_count: summary.already_attended_count + summary.duplicate_input_count,
      removed_count: summary.will_remove_count,
      problem_count: summary.problem_count
    }).catch(() => {});
  }

  return {
    ok: true,
    mode: input.mode,
    date: input.date,
    run_type: input.eventType,
    summary,
    rows
  };
}

async function commitAttendance(body, auth) {
  const input = normalizeInput(body);
  if (input.mode === "replace") {
    const confirmed = body?.confirmed === true
      && body?.replace_confirmed === true
      && String(body?.confirm_text || "").trim() === "교체합니다";
    if (!confirmed) {
      return jsonBody(false, "전체 교체는 체크박스와 확인 문구가 필요합니다.");
    }
  }
  if (body?.confirmed !== true) {
    return jsonBody(false, "저장 전 확인이 필요합니다.");
  }

  const preview = await previewAttendance(body, null);
  const problemRows = preview.rows.filter((row) => ["ambiguous_name", "not_found", "not_approved", "inactive"].includes(row.status));
  const members = await loadMembers();
  const logs = await loadAttendanceLogs();
  const scopeLogs = findAttendanceLogsByScope(logs, input.date, input.eventType);
  const monthKey = monthKeyFromDate(input.date);
  const willAddRows = preview.rows.filter((row) => row.status === "will_add");
  const willRemoveRows = input.mode === "replace" ? preview.rows.filter((row) => row.status === "will_remove") : [];
  const addedNames = [];
  const removedNames = [];

  for (const row of willRemoveRows) {
    const member = row.member_id ? members.find((item) => String(item.id) === String(row.member_id)) : null;
    if (member) {
      await updateMemberRuns(member, -1, monthKey);
      removedNames.push(member.name);
    }
  }

  for (const row of willAddRows) {
    const member = members.find((item) => String(item.id) === String(row.member_id));
    if (member) {
      await updateMemberRuns(member, 1, monthKey);
      addedNames.push(member.name);
    }
  }

  const unchangedNames = preview.rows
    .filter((row) => row.status === "unchanged" || row.status === "already_attended")
    .map((row) => row.member_name)
    .filter(Boolean);
  const finalMatched = input.mode === "replace"
    ? uniqueNames([...unchangedNames, ...addedNames])
    : uniqueNames([
        ...scopeLogs.flatMap((log) => Array.isArray(log?.matched) ? log.matched : []),
        ...addedNames
      ]);
  const unmatched = preview.rows.filter((row) => row.status === "not_found").map((row) => row.input_name);
  const ambiguous = preview.rows.filter((row) => row.status === "ambiguous_name").map((row) => row.input_name);

  await replaceScopeAttendanceLogs(scopeLogs, {
    source: input.mode === "replace" ? "replace" : "append",
    event_type: input.eventType,
    attendance_date: input.date,
    raw_count: input.rawNames.length,
    matched: finalMatched,
    unmatched,
    ambiguous,
    created_at: new Date().toISOString()
  });

  const summary = {
    ...preview.summary,
    added_count: addedNames.length,
    removed_count: removedNames.length,
    skipped_count: preview.summary.already_attended_count + preview.summary.duplicate_input_count,
    problem_count: problemRows.length,
    matched: addedNames,
    removed: removedNames,
    unmatched,
    ambiguous,
    already_present: preview.rows.filter((row) => row.status === "already_attended").map((row) => row.member_name).filter(Boolean),
    replaced_existing: input.mode === "replace"
  };

  await tryInsertOperationLog(auth, input.mode === "replace" ? "attendance_replace" : "attendance_append", {
    date: input.date,
    run_type: input.eventType,
    mode: input.mode,
    input_count: input.rawNames.length,
    added_count: addedNames.length,
    skipped_count: summary.skipped_count,
    removed_count: removedNames.length,
    problem_count: problemRows.length,
    before: scopeLogs.map((log) => ({ id: log.id, matched: log.matched || [] })),
    after: { matched: finalMatched, unmatched, ambiguous }
  });

  return {
    ok: true,
    mode: input.mode,
    date: input.date,
    run_type: input.eventType,
    summary,
    rows: preview.rows
  };
}

function normalizeInput(body) {
  const date = String(body?.date || body?.attendance_date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("날짜를 YYYY-MM-DD 형식으로 선택해 주세요.");
  }
  const mode = String(body?.mode || "append").trim();
  if (!VALID_MODES.has(mode)) {
    throw new Error("출석 입력 모드를 선택해 주세요.");
  }
  const eventType = normalizeRunType(body?.run_type || body?.event_type || "regular");
  if (!eventType) {
    throw new Error("출석 유형을 선택해 주세요.");
  }
  const namesText = Array.isArray(body?.names)
    ? body.names.join("\n")
    : String(body?.names_text || body?.namesText || "");
  const rawNames = parseNames(namesText);
  if (!rawNames.length) {
    throw new Error("참석자 명단을 입력해 주세요.");
  }
  return { date, mode, eventType, namesText, rawNames };
}

function normalizeRunType(value) {
  const raw = String(value || "").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (["regular", "정기런", "정기"].includes(compact)) {
    return "정기런";
  }
  if (["flash", "번개런", "번개"].includes(compact)) {
    return "번개런";
  }
  if (["event", "official", "공식행사", "행사"].includes(compact)) {
    return "공식 행사";
  }
  if (["hiking", "등산"].includes(compact)) {
    return "등산";
  }
  if (["smallgroup", "small_group", "소모임"].includes(compact)) {
    return "소모임";
  }
  return raw.slice(0, 20);
}

function parseNames(value) {
  return String(value || "")
    .split(/[\n\r,;|\t]+/)
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return [];
      }
      const spaceParts = trimmed.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean);
      return spaceParts.length > 1 ? spaceParts : [trimmed];
    })
    .map((name) => name.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);
}

function buildRow({ inputName, member = null, status, message, candidates = [], index = 0 }) {
  return {
    input_name: inputName,
    member_id: member?.id || null,
    member_name: member?.name || "",
    birth_year: member?.birth_year || null,
    status,
    message,
    candidates,
    order: index + 1
  };
}

function summarizeRows(rows, inputCount) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    input_count: inputCount,
    will_add_count: count("will_add"),
    already_attended_count: count("already_attended"),
    duplicate_input_count: count("duplicate_input"),
    ambiguous_name_count: count("ambiguous_name"),
    not_found_count: count("not_found"),
    not_approved_count: count("not_approved"),
    inactive_count: count("inactive"),
    will_remove_count: count("will_remove"),
    unchanged_count: count("unchanged"),
    problem_count: rows.filter((row) => ["ambiguous_name", "not_found", "not_approved", "inactive"].includes(row.status)).length
  };
}

async function replaceScopeAttendanceLogs(scopeLogs, payload) {
  for (const log of scopeLogs) {
    await supabaseDelete(`${ATTENDANCE_TABLE}?id=eq.${encodeURIComponent(log.id)}`);
  }
  await supabaseInsert(ATTENDANCE_TABLE, payload);
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
  const rows = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=role,approval_status,name&limit=1`);
  const profile = Array.isArray(rows) ? rows[0] || null : null;
  return { ok: profile?.role === "admin" && profile?.approval_status === "approved", user, profile };
}

async function loadMembers() {
  const attempts = [
    `${MEMBER_TABLE}?select=id,name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active&order=name.asc&limit=1000`,
    `${MEMBER_TABLE}?select=id,name,birth_year,total_runs,monthly_runs,fee_status,is_active&order=name.asc&limit=1000`,
    `${MEMBER_TABLE}?select=id,name,birth_year,total_runs,monthly_runs,is_active&order=name.asc&limit=1000`
  ];
  for (const path of attempts) {
    try {
      return await supabaseSelect(path);
    } catch (error) {
      const message = String(error?.message || error || "");
      if (!message.includes("aliases") && !message.includes("fee_status")) {
        throw error;
      }
    }
  }
  return [];
}

async function loadProfiles() {
  return supabaseSelect(`${PROFILE_TABLE}?select=user_id,name,birth_year,approval_status&limit=1000`).catch(() => []);
}

async function loadAttendanceLogs() {
  return supabaseSelect(`${ATTENDANCE_TABLE}?select=id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at&order=created_at.desc&limit=1000`);
}

function findAttendanceLogsByScope(logs, date, eventType) {
  return (Array.isArray(logs) ? logs : []).filter((log) => (
    String(log?.attendance_date || "") === date
    && String(log?.event_type || "") === eventType
  ));
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
    return { type: "unique", member: exactMatches[0], candidates: [] };
  }
  if (exactMatches.length > 1) {
    return { type: "ambiguous", candidates: exactMatches.map(candidateMember) };
  }

  const partialMatches = members.filter((member) => {
    const memberName = normalizeName(member.name);
    return normalized.length >= 2 && (memberName.includes(normalized) || normalized.includes(memberName));
  });
  if (partialMatches.length === 1) {
    return { type: "unique", member: partialMatches[0], candidates: [] };
  }
  if (partialMatches.length > 1) {
    return { type: "ambiguous", candidates: partialMatches.map(candidateMember) };
  }
  return { type: "not_found", candidates: [] };
}

function candidateMember(member) {
  return {
    id: member.id,
    name: member.name,
    birth_year: member.birth_year,
    is_active: member.is_active !== false
  };
}

function findProfileStatus(member, profiles) {
  const matched = (Array.isArray(profiles) ? profiles : []).find((profile) => (
    normalizeName(profile?.name) === normalizeName(member?.name)
    && Number(profile?.birth_year || 0) === Number(member?.birth_year || 0)
  ));
  return matched?.approval_status || "";
}

async function updateMemberRuns(member, delta, monthKey) {
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {};
  const nextTotal = Math.max(0, Number(member?.total_runs || 0) + delta);
  const nextMonthly = Math.max(0, Number(monthlyRuns[monthKey] || 0) + delta);
  await supabasePatch(`${MEMBER_TABLE}?id=eq.${encodeURIComponent(member.id)}`, {
    total_runs: nextTotal,
    monthly_runs: { ...monthlyRuns, [monthKey]: nextMonthly }
  });
  member.total_runs = nextTotal;
  member.monthly_runs = { ...monthlyRuns, [monthKey]: nextMonthly };
}

async function tryInsertOperationLog(auth, action, metadata) {
  try {
    await supabaseInsert(LOG_TABLE, {
      actor_user_id: auth.user?.id || null,
      actor_name: String(auth.profile?.name || auth.user?.email || "admin").slice(0, 120),
      action,
      detail: JSON.stringify(metadata).slice(0, 4000)
    });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (!message.includes(LOG_TABLE)) {
      throw error;
    }
  }
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

function uniqueNames(names) {
  const map = new Map();
  (Array.isArray(names) ? names : []).forEach((name) => {
    const cleanName = String(name || "").trim();
    const key = normalizeName(cleanName);
    if (key && !map.has(key)) {
      map.set(key, cleanName);
    }
  });
  return Array.from(map.values());
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function monthKeyFromDate(value) {
  const [year, month] = String(value || "").split("-");
  return `${year}-${month}`;
}

function extractBearerToken(header) {
  const [type, token] = String(header || "").split(" ");
  if ((type || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

function jsonBody(ok, error) {
  return { ok, error };
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
