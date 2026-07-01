const CHALLENGE_TABLE = "member_challenges";
const ENTRY_TABLE = "member_challenge_entries";

export default async (request) => {
  try {
    if (request.method !== "GET") {
      return json(405, { ok: false, error: "method not allowed" });
    }

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 3), 6));
    const rows = await listPublicChallenges(limit).catch((error) => {
      if (isMissingTableError(error, CHALLENGE_TABLE) || isMissingTableError(error, ENTRY_TABLE)) {
        return null;
      }
      throw error;
    });

    if (!rows) {
      return json(200, { ok: true, available: false, items: [] });
    }

    const items = rows
      .filter((item) => ["recruiting", "in_progress"].includes(String(item.status || "")))
      .filter((item) => normalizeChallengeMode(item.mode) !== "betting_pool")
      .slice(0, limit)
      .map(toPublicChallenge);

    return json(200, { ok: true, available: true, items });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function listPublicChallenges(limit) {
  const challenges = await selectChallenges(Math.max(limit * 3, 9));
  const entries = await selectEntriesForList();
  const entryCounts = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = String(entry.challenge_id || "");
    entryCounts.set(key, Number(entryCounts.get(key) || 0) + 1);
  });
  return (Array.isArray(challenges) ? challenges : []).map((challenge) => ({
    ...challenge,
    entry_count: entryCounts.get(String(challenge.id || "")) || 0
  }));
}

async function selectChallenges(limit) {
  const select = "id,title,mode,entry_points,success_reward_points,min_participants,verification_method,progress_current,progress_target,recruit_start_date,recruit_end_date,start_date,end_date,status,created_at";
  const query = `${CHALLENGE_TABLE}?status=in.(recruiting,in_progress)&order=created_at.desc&limit=${limit}&select=${select}`;
  return supabaseSelect(query);
}

async function selectEntriesForList() {
  return supabaseSelect(`${ENTRY_TABLE}?order=created_at.asc&limit=500&select=challenge_id`);
}

function toPublicChallenge(item) {
  const mode = normalizeChallengeMode(item.mode);
  const progressCurrent = Number(item.progress_current || item.entry_count || 0);
  const progressTarget = Number(item.progress_target || item.min_participants || 1);
  const progressPercent = progressTarget > 0 ? Math.min(100, Math.round((progressCurrent / progressTarget) * 100)) : 0;
  return {
    id: item.id,
    title: item.title || "RRC 챌린지",
    mode,
    mode_label: modeLabel(mode),
    status: item.status,
    status_label: item.status === "in_progress" ? "진행 중" : "모집 중",
    entry_points: Number(item.entry_points || 0),
    success_reward_points: Number(item.success_reward_points || 0),
    min_participants: Number(item.min_participants || 1),
    participant_count: Number(item.entry_count || 0),
    progress_percent: progressPercent,
    recruit_end_date: item.recruit_end_date || item.start_date || "",
    start_date: item.start_date || "",
    end_date: item.end_date || "",
    verification_method: item.verification_method || "RRC 카카오톡 채팅방 인증"
  };
}

function modeLabel(mode) {
  switch (normalizeChallengeMode(mode)) {
    case "deposit": return "소액 예치형";
    case "team_goal": return "팀 달성형";
    case "betting_pool": return "베팅 분배형";
    default: return "무료 입문형";
  }
}

function normalizeChallengeMode(mode) {
  const value = String(mode || "free_intro").trim();
  return ["free_intro", "deposit", "team_goal", "betting_pool"].includes(value) ? value : "free_intro";
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
  const value = Netlify.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function isMissingTableError(error, table) {
  const message = String(error?.message || error || "");
  return message.includes(table) && (message.includes("schema cache") || message.includes("does not exist") || message.includes("Could not find the table"));
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
