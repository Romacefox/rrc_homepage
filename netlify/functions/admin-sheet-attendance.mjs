const PROFILE_TABLE = "member_profiles";

const CATEGORY_LABELS = {
  regular: "정기런",
  flash: "번개런",
  official: "공식 행사",
  hiking: "등산",
  small_group: "소모임"
};

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
    const url = normalizeSheetUrl(body?.sheet_url || body?.csv_url || "");
    const pastedText = String(body?.csv_text || body?.sheet_text || "").trim();
    const monthKey = normalizeMonthKey(body?.month_key || body?.month || "");
    if (!url && !pastedText) {
      return json(400, { ok: false, error: "Google Sheets CSV 주소를 입력하거나 시트 내용을 붙여넣어 주세요." });
    }

    const text = pastedText || await fetchCsvText(url);
    const parsed = parseAttendanceCsv(text, monthKey);
    return json(200, {
      ok: true,
      ...parsed
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function fetchCsvText(url) {
  const response = await fetch(url, { headers: { "user-agent": "RRC Admin Sheet Import" } });
  if (!response.ok) {
    throw new Error("시트 CSV를 불러오지 못했습니다. 공유 또는 게시 설정을 확인해 주세요.");
  }
  const text = await response.text();
  if (looksLikeHtml(text)) {
    throw new Error("CSV 대신 Google 로그인/문서 화면이 내려왔습니다. 시트를 CSV로 게시하거나 공유 설정을 확인해 주세요.");
  }
  return text;
}

function looksLikeHtml(text) {
  const source = String(text || "");
  return /^\s*<!doctype html/i.test(source) || /^\s*<html[\s>]/i.test(source);
}

function parseAttendanceCsv(text, monthKey = "") {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV에서 출석 데이터를 찾지 못했습니다.");
  }

  const header = rows[0].map((cell) => String(cell || "").trim());
  const dateIndex = findHeaderIndex(header, ["date", "attendance date", "날짜"]) ?? 0;
  const nameIndex = findHeaderIndex(header, ["name", "member", "이름", "성명"]) ?? 1;
  const categoryIndex = findHeaderIndex(header, ["category", "type", "event", "유형", "카테고리"]) ?? 2;
  const groups = new Map();
  const invalidRows = [];
  let validRows = 0;

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const date = normalizeDate(row[dateIndex]);
    const name = String(row[nameIndex] || "").trim();
    const category = normalizeCategory(row[categoryIndex]);

    if (!date && !name && !String(row[categoryIndex] || "").trim()) {
      return;
    }
    if (!date || !name || !category) {
      invalidRows.push({
        row_number: rowNumber,
        date: String(row[dateIndex] || "").trim(),
        name,
        category: String(row[categoryIndex] || "").trim(),
        reason: !date ? "날짜 확인 필요" : !name ? "이름 확인 필요" : "유형 확인 필요"
      });
      return;
    }
    if (monthKey && !date.startsWith(`${monthKey}-`)) {
      return;
    }

    validRows += 1;
    const key = `${date}|${category}`;
    const group = groups.get(key) || {
      date,
      run_type: category,
      label: CATEGORY_LABELS[category] || category,
      names: []
    };
    if (!group.names.some((item) => normalizeName(item) === normalizeName(name))) {
      group.names.push(name);
    }
    groups.set(key, group);
  });

  const groupedRows = Array.from(groups.values())
    .map((group) => ({ ...group, count: group.names.length }))
    .sort((a, b) => `${a.date} ${a.label}`.localeCompare(`${b.date} ${b.label}`, "ko"));

  return {
    total_rows: Math.max(0, rows.length - 1),
    valid_rows: validRows,
    invalid_rows: invalidRows,
    groups: groupedRows
  };
}

function normalizeSheetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    if (url.hostname.includes("docs.google.com") && url.pathname.includes("/spreadsheets/")) {
      if (url.pathname.includes("/pub")) {
        url.searchParams.set("output", "csv");
        return url.toString();
      }
      const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      const gid = url.searchParams.get("gid") || raw.match(/[#&]gid=(\d+)/)?.[1] || "0";
      if (match?.[1]) {
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
      }
    }
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function normalizeMonthKey(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function findHeaderIndex(header, candidates) {
  const normalized = header.map((cell) => cell.replace(/\s+/g, " ").trim().toLowerCase());
  const index = normalized.findIndex((cell) => candidates.includes(cell));
  return index >= 0 ? index : null;
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) {
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  }
  if (/^\d{5}$/.test(raw)) {
    const date = new Date((Number(raw) - 25569) * 86400 * 1000);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }
  }
  return "";
}

function normalizeCategory(value) {
  const raw = String(value || "").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (!compact) {
    return "";
  }
  if (compact === "regular" || compact.includes("정기")) {
    return "regular";
  }
  if (compact === "flash" || compact.includes("번개")) {
    return "flash";
  }
  if (compact === "hiking" || compact.includes("등산")) {
    return "hiking";
  }
  if (compact === "smallgroup" || compact === "small_group" || compact.includes("소모임")) {
    return "small_group";
  }
  if (compact === "official" || compact === "event" || compact.includes("공식") || compact.includes("행사")) {
    return "official";
  }
  return "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((cell) => String(cell || "").trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  row.push(field);
  if (row.some((cell) => String(cell || "").trim())) {
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
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

function extractBearerToken(header) {
  const [type, token] = String(header || "").split(" ");
  if ((type || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function pad(value) {
  return String(value).padStart(2, "0");
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
