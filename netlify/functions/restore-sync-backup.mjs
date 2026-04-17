export default async (request) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const backupSetting = await loadBackupSetting();
    const backupData = backupSetting?.value?.data || null;
    if (!backupData) {
      return json(404, { ok: false, error: "backup not found" });
    }

    const members = normalizeMembers(backupData.members);
    const notices = normalizeNotices(backupData.notices);
    const guests = normalizeGuests(backupData.guests);
    const attendanceLogs = normalizeAttendanceLogs(backupData.attendance_logs);
    const raffleHistory = normalizeRaffleHistory(backupData.raffle_history);

    await replaceMembersTable(members);
    await replaceTable("notices", notices);
    await replaceTable("guests", guests);
    await replaceTable("attendance_logs", attendanceLogs);
    await replaceTable("raffle_history", raffleHistory);
    await upsertSetting("last_sync_meta", {
      synced_at: new Date().toISOString(),
      restored_from_backup_at: backupSetting?.value?.backed_up_at || null,
      counts: {
        members: members.length,
        notices: notices.length,
        guests: guests.length,
        attendance_logs: attendanceLogs.length,
        raffle_history: raffleHistory.length
      }
    });

    return json(200, {
      ok: true,
      counts: {
        members: members.length,
        notices: notices.length,
        guests: guests.length,
        attendance_logs: attendanceLogs.length,
        raffle_history: raffleHistory.length
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

async function loadBackupSetting() {
  const rows = await supabaseSelect("settings?key=eq.last_sync_backup&select=key,value,updated_at&limit=1");
  return Array.isArray(rows) ? rows[0] || null : null;
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

async function replaceTable(table, rows) {
  await supabaseDeleteAll(table);
  if (rows.length > 0) {
    await supabaseInsert(table, rows);
  }
}

async function replaceMembersTable(rows) {
  const insertRows = await resolveMembersInsertRows(rows);
  await supabaseDeleteAll("members");
  if (insertRows.length === 0) {
    return;
  }

  await supabaseInsert("members", insertRows);
}

async function resolveMembersInsertRows(rows) {
  const attempts = [
    { path: "members?select=name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active&limit=1", omit: [] },
    { path: "members?select=name,birth_year,total_runs,monthly_runs,fee_status,is_active&limit=1", omit: ["aliases"] },
    { path: "members?select=name,birth_year,total_runs,monthly_runs,is_active&limit=1", omit: ["fee_status", "aliases"] }
  ];

  for (const attempt of attempts) {
    try {
      await supabaseSelect(attempt.path);
      return rows.map((row) => {
        const nextRow = { ...row };
        attempt.omit.forEach((key) => {
          delete nextRow[key];
        });
        return nextRow;
      });
    } catch (error) {
      const missingKnownColumn = isMissingColumnError(error, "fee_status") || isMissingColumnError(error, "aliases");
      if (!missingKnownColumn) {
        throw error;
      }
    }
  }

  return rows.map(({ fee_status, aliases, ...rest }) => rest);
}

function normalizeMembers(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 300).map((item) => ({
    name: String(item?.name || "이름없음").slice(0, 80),
    birth_year: clampNumber(item?.birth_year, 1989, 2000, 1994),
    total_runs: Math.max(0, Number(item?.total_runs || 0)),
    monthly_runs: item?.monthly_runs && typeof item.monthly_runs === "object" ? item.monthly_runs : {},
    fee_status: item?.fee_status && typeof item.fee_status === "object" ? item.fee_status : {},
    aliases: Array.isArray(item?.aliases) ? item.aliases : [],
    is_active: item?.is_active !== false
  }));
}

function normalizeNotices(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 300).map((item) => ({
    title: String(item?.title || "공지").slice(0, 120),
    content: String(item?.content || "").slice(0, 4000),
    created_at: item?.created_at || new Date().toISOString()
  }));
}

function normalizeGuests(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 500).map((item) => ({
    name: String(item?.name || "게스트").slice(0, 80),
    birth_year: clampNumber(item?.birth_year, 1989, 2000, 1994),
    phone: String(item?.phone || "").slice(0, 40),
    message: String(item?.message || "").slice(0, 4000),
    status: String(item?.status || "대기").slice(0, 20),
    created_at: item?.created_at || new Date().toISOString()
  }));
}

function normalizeAttendanceLogs(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 500).map((item) => ({
    source: String(item?.source || "bulk").slice(0, 20),
    event_type: String(item?.event_type || "정기런").slice(0, 20),
    attendance_date: item?.attendance_date || new Date().toISOString().slice(0, 10),
    raw_count: Math.max(0, Number(item?.raw_count || 0)),
    matched: Array.isArray(item?.matched) ? item.matched : [],
    unmatched: Array.isArray(item?.unmatched) ? item.unmatched : [],
    ambiguous: Array.isArray(item?.ambiguous) ? item.ambiguous : [],
    created_at: item?.created_at || new Date().toISOString()
  }));
}

function normalizeRaffleHistory(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 100).map((item) => ({
    draw_id: String(item?.draw_id || "").slice(0, 120) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    target_month_key: String(item?.target_month_key || "").slice(0, 7),
    threshold: Math.max(0, Number(item?.threshold || 0)),
    winner_count: Math.max(0, Number(item?.winner_count || 0)),
    winners: Array.isArray(item?.winners) ? item.winners : [],
    created_at: item?.created_at || new Date().toISOString()
  }));
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes(String(columnName || "").toLowerCase()) && message.includes("does not exist");
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

async function upsertSetting(key, value) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
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
