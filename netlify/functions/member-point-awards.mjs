const TABLE = "member_point_awards";
const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const monthKey = normalizeMonthKey(url.searchParams.get("month_key")) || currentMonthKey();
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 30), 100));
      const rows = await listAwards(monthKey, limit).catch((error) => {
        if (isMissingTableError(error, TABLE)) {
          return null;
        }
        throw error;
      });
      if (!rows) {
        return json(200, { ok: true, available: false, items: [], can_manage: auth.isAdmin });
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
