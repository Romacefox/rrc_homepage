const TABLE = "member_point_awards";
const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";
const PHOTO_TABLE = "photos";
const COMMENT_TABLE = "photo_comments";
const PHOTO_POINTS = 5;
const PHOTO_MONTHLY_CAP = 5;
const COMMENT_POINTS = 2;
const COMMENT_MONTHLY_CAP = 10;

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const monthKey = normalizeMonthKey(url.searchParams.get("month_key")) || currentMonthKey();
      const publicMode = String(url.searchParams.get("public") || "") === "ranking";
      const period = String(url.searchParams.get("period") || "");
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || (publicMode ? 500 : 30)), 500));
      const rows = await listAwardsForRequest({ monthKey, period, publicMode, limit }).catch((error) => {
        if (isMissingTableError(error, TABLE)) {
          return null;
        }
        throw error;
      });
      if (!rows) {
        return json(200, { ok: true, available: false, items: [], can_manage: auth.isAdmin });
      }
      if (publicMode) {
        return json(200, {
          ok: true,
          available: true,
          items: [],
          ranking: await buildPublicPointRanking(monthKey, rows, period === "year" ? "year" : "month"),
          can_manage: auth.isAdmin
        });
      }
      const normalizedProfileName = normalizeName(auth.profile?.name || "");
      const items = auth.isAdmin
        ? rows
        : rows.filter((item) => item.user_id === auth.user.id || normalizeName(item.member_name) === normalizedProfileName);
      return json(200, { ok: true, available: true, items, can_manage: auth.isAdmin });
    }

    if (request.method === "POST") {
      if (!auth.isAdmin) {
        return json(403, { ok: false, error: "admin only" });
      }

      const body = await request.json();
      const memberName = String(body?.member_name || "").trim().slice(0, 80);
      const monthKey = normalizeMonthKey(body?.month_key);
      const awardCode = String(body?.award_code || "").trim().slice(0, 60);
      const awardLabel = String(body?.award_label || "").trim().slice(0, 80);
      const points = Math.max(1, Math.min(Number(body?.points || 0), 500));
      const note = String(body?.note || "").trim().slice(0, 300);
      if (!memberName || !monthKey || !awardCode || !awardLabel || !points) {
        return json(400, { ok: false, error: "invalid payload" });
      }

      const targetProfile = await findProfileByName(memberName);
      await supabaseInsert(TABLE, {
        user_id: targetProfile?.user_id || null,
        member_name: targetProfile?.name || memberName,
        month_key: monthKey,
        award_code: awardCode,
        award_label: awardLabel,
        points,
        note,
        granted_by_user_id: auth.user.id,
        granted_by_name: auth.profile?.name || auth.user.email || "admin"
      });
      await tryInsertOperationLog(auth, "포인트 지급", `${memberName}: ${awardLabel} ${points}P`);
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: "method not allowed" });
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
  const isApproved = profile?.approval_status === "approved";
  const isAdmin = isApproved && profile?.role === "admin";
  return { ok: Boolean(isApproved), user, profile, isAdmin };
}

async function listAwards(monthKey, limit) {
  return supabaseSelect(`${TABLE}?month_key=eq.${encodeURIComponent(monthKey)}&order=created_at.desc&limit=${limit}&select=id,user_id,member_name,month_key,award_code,award_label,points,note,granted_by_name,created_at`);
}

async function listAwardsForRequest({ monthKey, period, publicMode, limit }) {
  if (period === "all" && !publicMode) {
    return listAwardsAll(limit);
  }
  if (period === "year" && publicMode) {
    return listAwardsYear(monthKey, limit);
  }
  return listAwards(monthKey, limit);
}

async function listAwardsYear(monthKey, limit) {
  const year = String(monthKey || currentMonthKey()).slice(0, 4);
  return supabaseSelect(`${TABLE}?month_key=gte.${encodeURIComponent(`${year}-01`)}&month_key=lte.${encodeURIComponent(`${year}-12`)}&order=created_at.desc&limit=${limit}&select=id,user_id,member_name,month_key,award_code,award_label,points,note,granted_by_name,created_at`);
}

async function listAwardsAll(limit) {
  return supabaseSelect(`${TABLE}?order=created_at.desc&limit=${limit}&select=id,user_id,member_name,month_key,award_code,award_label,points,note,granted_by_name,created_at`);
}

async function findProfileByName(memberName) {
  const rows = await supabaseSelect(`${PROFILE_TABLE}?approval_status=eq.approved&select=user_id,name&limit=500`);
  const normalized = normalizeName(memberName);
  return (Array.isArray(rows) ? rows : []).find((row) => normalizeName(row.name) === normalized) || null;
}

function normalizeMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

async function buildPublicPointRanking(monthKey, awardRows, period = "month") {
  const range = period === "year" ? getYearDateRange(monthKey) : getMonthDateRange(monthKey);
  const [profiles, photos, comments] = await Promise.all([
    supabaseSelect(`${PROFILE_TABLE}?approval_status=eq.approved&select=user_id,name,created_at&limit=1000`).catch(() => []),
    supabaseSelect(`${PHOTO_TABLE}?created_at=gte.${encodeURIComponent(range.start)}&created_at=lt.${encodeURIComponent(range.end)}&select=user_id,created_at&limit=1000`).catch(() => []),
    supabaseSelect(`${COMMENT_TABLE}?created_at=gte.${encodeURIComponent(range.start)}&created_at=lt.${encodeURIComponent(range.end)}&select=user_id,created_at&limit=1000`).catch(() => [])
  ]);
  const profileByUserId = new Map(
    (Array.isArray(profiles) ? profiles : []).map((profile) => [String(profile.user_id || ""), String(profile.name || "회원")])
  );
  const grouped = new Map();

  const ensureGroup = (name) => {
    const memberName = String(name || "회원");
    const key = normalizeName(memberName);
    if (!key) {
      return null;
    }
    const previous = grouped.get(key) || {
      member_name: memberName,
      points: 0,
      award_points: 0,
      photo_points: 0,
      comment_points: 0
    };
    grouped.set(key, previous);
    return previous;
  };

  (Array.isArray(awardRows) ? awardRows : []).forEach((row) => {
    const group = ensureGroup(row.member_name);
    if (!group) {
      return;
    }
    const points = Number(row.points || 0);
    group.points += points;
    group.award_points += points;
  });

  addVirtualSignupBonuses({ profiles, awardRows, grouped, period, monthKey });

  const photoCounts = period === "year"
    ? countMonthlyCappedDailyPointEventsByUserId(photos, PHOTO_MONTHLY_CAP)
    : countDailyPointEventsByUserId(photos);
  photoCounts.forEach((count, userId) => {
    const group = ensureGroup(profileByUserId.get(userId));
    if (!group) {
      return;
    }
    const points = Math.min(Number(count || 0), PHOTO_MONTHLY_CAP) * PHOTO_POINTS;
    group.points += points;
    group.photo_points += points;
  });

  const commentCounts = period === "year"
    ? countMonthlyCappedDailyPointEventsByUserId(comments, COMMENT_MONTHLY_CAP)
    : countDailyPointEventsByUserId(comments);
  commentCounts.forEach((count, userId) => {
    const group = ensureGroup(profileByUserId.get(userId));
    if (!group) {
      return;
    }
    const points = Math.min(Number(count || 0), COMMENT_MONTHLY_CAP) * COMMENT_POINTS;
    group.points += points;
    group.comment_points += points;
  });

  return [...grouped.values()]
    .sort((a, b) => (Number(b.points || 0) - Number(a.points || 0)) || String(a.member_name || "").localeCompare(String(b.member_name || ""), "ko"))
    .slice(0, 50);
}

function addVirtualSignupBonuses({ profiles, awardRows, grouped, period, monthKey }) {
  const existingSignupUserIds = new Set(
    (Array.isArray(awardRows) ? awardRows : [])
      .filter((row) => row.award_code === "signup_bonus")
      .map((row) => String(row.user_id || ""))
      .filter(Boolean)
  );
  const selectedYear = String(monthKey || currentMonthKey()).slice(0, 4);
  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const userId = String(profile.user_id || "");
    if (!userId || existingSignupUserIds.has(userId)) {
      return;
    }
    const createdMonth = toMonthKey(profile.created_at);
    if (!createdMonth) {
      return;
    }
    const shouldCount = period === "year"
      ? createdMonth.slice(0, 4) === selectedYear
      : createdMonth === monthKey;
    if (!shouldCount) {
      return;
    }
    const memberName = String(profile.name || "회원");
    const key = normalizeName(memberName);
    if (!key) {
      return;
    }
    const group = grouped.get(key) || {
      member_name: memberName,
      points: 0,
      award_points: 0,
      photo_points: 0,
      comment_points: 0
    };
    group.points += 20;
    group.award_points += 20;
    grouped.set(key, group);
  });
}

function countDailyPointEventsByUserId(rows) {
  const daysByUserId = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const userId = String(row.user_id || "");
    const dayKey = toDateKey(row.created_at);
    if (!userId || !dayKey) {
      return;
    }
    const days = daysByUserId.get(userId) || new Set();
    days.add(dayKey);
    daysByUserId.set(userId, days);
  });
  const counts = new Map();
  daysByUserId.forEach((days, userId) => {
    counts.set(userId, days.size);
  });
  return counts;
}

function countMonthlyCappedDailyPointEventsByUserId(rows, monthlyCap) {
  const daysByUserMonth = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const userId = String(row.user_id || "");
    const monthKey = toMonthKey(row.created_at);
    const dayKey = toDateKey(row.created_at);
    if (!userId || !monthKey || !dayKey) {
      return;
    }
    const key = `${userId}:${monthKey}`;
    const days = daysByUserMonth.get(key) || new Set();
    days.add(dayKey);
    daysByUserMonth.set(key, days);
  });
  const counts = new Map();
  daysByUserMonth.forEach((days, key) => {
    const userId = key.split(":")[0];
    counts.set(userId, Number(counts.get(userId) || 0) + Math.min(days.size, Number(monthlyCap || 0)));
  });
  return counts;
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDateRange(monthKey) {
  const [year, month] = String(monthKey || currentMonthKey()).split("-").map(Number);
  const startDate = new Date(Date.UTC(year || new Date().getFullYear(), (month || 1) - 1, 1));
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

function getYearDateRange(monthKey) {
  const year = Number(String(monthKey || currentMonthKey()).slice(0, 4)) || new Date().getFullYear();
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year + 1, 0, 1));
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
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

function isMissingTableError(error, table) {
  const message = String(error?.message || error || "");
  return message.includes(table) && (message.includes("schema cache") || message.includes("does not exist") || message.includes("Could not find the table"));
}

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
