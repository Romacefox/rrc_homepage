const CHALLENGE_TABLE = "member_challenges";
const ENTRY_TABLE = "member_challenge_entries";
const AWARD_TABLE = "member_point_awards";
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
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 12), 30));
      const rows = await listChallenges(limit).catch((error) => {
        if (isMissingTableError(error, CHALLENGE_TABLE) || isMissingTableError(error, ENTRY_TABLE)) {
          return null;
        }
        throw error;
      });
      if (!rows) {
        return json(200, { ok: true, available: false, items: [], can_manage: auth.isAdmin });
      }

      const visibleItems = auth.isAdmin
        ? rows
        : rows.filter((item) => item.status !== "submitted" || item.creator_user_id === auth.user.id);
      return json(200, { ok: true, available: true, items: visibleItems, can_manage: auth.isAdmin });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const title = String(body?.title || "").trim().slice(0, 80);
      const stakePoints = Math.max(1, Math.min(Number(body?.stake_points || 0), 500));
      const startDate = normalizeDate(body?.start_date);
      const endDate = normalizeDate(body?.end_date);
      const verificationTag = String(body?.verification_tag || "").trim().slice(0, 40);
      const ruleText = String(body?.rule_text || "").trim().slice(0, 600);

      if (!title || !stakePoints || !startDate || !endDate || !ruleText) {
        return json(400, { ok: false, error: "invalid payload" });
      }
      if (endDate < startDate) {
        return json(400, { ok: false, error: "invalid date range" });
      }

      await supabaseInsert(CHALLENGE_TABLE, {
        creator_user_id: auth.user.id,
        creator_name: auth.profile?.name || auth.user.email || "member",
        title,
        stake_points: stakePoints,
        start_date: startDate,
        end_date: endDate,
        verification_tag: verificationTag,
        kakao_room: "RRC 카카오톡 채팅방",
        rule_text: ruleText,
        status: "submitted"
      });
      await tryInsertOperationLog(auth, "챌린지 제안", `${title} / ${stakePoints}P`);
      return json(200, { ok: true });
    }

    if (request.method === "PATCH") {
      const body = await request.json();
      const action = String(body?.action || "").trim();

      if (action === "join") {
        const challengeId = String(body?.challenge_id || "").trim();
        const challenge = await loadChallenge(challengeId);
        if (!challenge || challenge.status !== "recruiting") {
          return json(400, { ok: false, error: "challenge is not recruiting" });
        }

        await supabaseInsert(ENTRY_TABLE, {
          challenge_id: challengeId,
          user_id: auth.user.id,
          member_name: auth.profile?.name || auth.user.email || "member",
          stake_points: Number(challenge.stake_points || 0),
          result: "joined"
        });
        await tryInsertOperationLog(auth, "챌린지 참가", `${challenge.title} / ${challenge.stake_points}P`);
        return json(200, { ok: true });
      }

      if (!auth.isAdmin) {
        return json(403, { ok: false, error: "admin only" });
      }

      if (action === "status") {
        const challengeId = String(body?.challenge_id || "").trim();
        const status = String(body?.status || "").trim();
        if (!challengeId || !["submitted", "recruiting", "in_progress", "judging", "settled", "cancelled"].includes(status)) {
          return json(400, { ok: false, error: "invalid payload" });
        }
        await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challengeId)}`, {
          status,
          updated_at: new Date().toISOString()
        });
        await tryInsertOperationLog(auth, "챌린지 상태 변경", `${challengeId}: ${status}`);
        return json(200, { ok: true });
      }

      if (action === "judge") {
        const entryId = String(body?.entry_id || "").trim();
        const result = String(body?.result || "").trim();
        if (!entryId || !["success", "failed"].includes(result)) {
          return json(400, { ok: false, error: "invalid payload" });
        }
        await supabasePatch(`${ENTRY_TABLE}?id=eq.${encodeURIComponent(entryId)}`, {
          result,
          judged_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        await tryInsertOperationLog(auth, "챌린지 판정", `${entryId}: ${result}`);
        return json(200, { ok: true });
      }

      if (action === "settle") {
        const challengeId = String(body?.challenge_id || "").trim();
        const challenge = await loadChallenge(challengeId);
        if (!challenge || challenge.status !== "judging") {
          return json(400, { ok: false, error: "challenge is not judging" });
        }

        const entries = await loadEntries(challengeId);
        const successEntries = entries.filter((entry) => entry.result === "success");
        const pot = entries.reduce((sum, entry) => sum + Number(entry.stake_points || 0), 0);
        const payoutPoints = successEntries.length ? Math.floor(pot / successEntries.length) : 0;

        for (const entry of entries) {
          await supabasePatch(`${ENTRY_TABLE}?id=eq.${encodeURIComponent(entry.id)}`, {
            payout_points: entry.result === "success" ? payoutPoints : 0,
            updated_at: new Date().toISOString()
          });
        }
        for (const entry of successEntries) {
          await tryInsertPointAward(auth, {
            userId: entry.user_id,
            memberName: entry.member_name,
            monthKey: monthKeyFromDate(challenge.end_date || new Date().toISOString()),
            awardCode: "challenge_payout",
            awardLabel: `챌린지 성공: ${challenge.title}`.slice(0, 80),
            points: payoutPoints,
            note: `참가 포인트 팟 ${pot}P / 성공 ${successEntries.length}명`
          });
        }
        await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challengeId)}`, {
          status: "settled",
          payout_points: payoutPoints,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        await tryInsertOperationLog(auth, "챌린지 정산", `${challenge.title}: ${successEntries.length}명 / ${payoutPoints}P`);
        return json(200, { ok: true, success_count: successEntries.length, payout_points: payoutPoints, pot_points: pot });
      }

      return json(400, { ok: false, error: "invalid action" });
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

async function listChallenges(limit) {
  const challenges = await supabaseSelect(`${CHALLENGE_TABLE}?order=created_at.desc&limit=${limit}&select=id,creator_user_id,creator_name,title,stake_points,start_date,end_date,verification_tag,kakao_room,rule_text,status,payout_points,created_at,updated_at,settled_at`);
  const entries = await supabaseSelect(`${ENTRY_TABLE}?order=created_at.asc&limit=500&select=id,challenge_id,user_id,member_name,stake_points,result,payout_points,created_at,judged_at`);
  const entriesByChallenge = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = String(entry.challenge_id || "");
    entriesByChallenge.set(key, [...(entriesByChallenge.get(key) || []), entry]);
  });
  return (Array.isArray(challenges) ? challenges : []).map((challenge) => ({
    ...challenge,
    entries: entriesByChallenge.get(String(challenge.id || "")) || []
  }));
}

async function loadChallenge(id) {
  if (!id) {
    return null;
  }
  const rows = await supabaseSelect(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(id)}&select=id,title,stake_points,status,end_date&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadEntries(challengeId) {
  return supabaseSelect(`${ENTRY_TABLE}?challenge_id=eq.${encodeURIComponent(challengeId)}&select=id,user_id,member_name,stake_points,result`);
}

function normalizeDate(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : "";
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

async function tryInsertPointAward(auth, award) {
  if (!Number(award.points || 0)) {
    return;
  }
  try {
    await supabaseInsert(AWARD_TABLE, {
      user_id: award.userId || null,
      member_name: String(award.memberName || "member").slice(0, 80),
      month_key: award.monthKey,
      award_code: award.awardCode,
      award_label: award.awardLabel,
      points: Number(award.points || 0),
      note: award.note,
      granted_by_user_id: auth.user?.id || null,
      granted_by_name: auth.profile?.name || auth.user?.email || "admin"
    });
  } catch (error) {
    if (!isMissingTableError(error, AWARD_TABLE)) {
      throw error;
    }
  }
}

function monthKeyFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return currentMonthKey();
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
