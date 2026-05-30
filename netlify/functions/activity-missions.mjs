const PROFILE_TABLE = "member_profiles";
const MEMBER_TABLE = "members";
const CLAIM_TABLE = "member_mission_claims";
const AWARD_TABLE = "member_point_awards";
const PHOTO_TABLE = "photos";
const COMMENT_TABLE = "photo_comments";
const CHALLENGE_ENTRY_TABLE = "member_challenge_entries";
const ATTENDANCE_TABLE = "attendance_logs";
const REWARD_TABLE = "reward_requests";

const MISSION_DEFS = [
  {
    key: "first_activity_visit",
    title: "활동보드 첫 방문",
    points: 20,
    period: "once",
    target: 1,
    cta: "활동보드 방문을 기록해 주세요.",
    incomplete: "활동보드에 들어오면 받을 수 있습니다."
  },
  {
    key: "check_attendance",
    title: "내 출석 기록 확인",
    points: 20,
    period: "once",
    target: 1,
    cta: "출석 기록을 확인했다면 포인트를 받을 수 있습니다.",
    incomplete: "내 출석 기록을 확인한 뒤 버튼을 눌러 주세요."
  },
  {
    key: "first_photo_upload",
    title: "사진 1장 업로드",
    points: 20,
    period: "once",
    target: 1,
    cta: "사진첩 업로드 기록이 확인되었습니다.",
    incomplete: "사진첩에서 사진을 1장 올려보세요."
  },
  {
    key: "first_comment",
    title: "댓글 1개 남기기",
    points: 10,
    period: "once",
    target: 1,
    cta: "댓글 작성 기록이 확인되었습니다.",
    incomplete: "사진첩에서 댓글을 1개 남겨보세요."
  },
  {
    key: "first_challenge_join",
    title: "챌린지 1개 참여",
    points: 50,
    period: "once",
    target: 1,
    cta: "챌린지 참여 기록이 확인되었습니다.",
    incomplete: "모집 중인 챌린지에 참여해 보세요."
  },
  {
    key: "monthly_regular_run_2",
    title: "월 2회 정기런 참여",
    points: 30,
    period: "monthly",
    target: 2,
    cta: "이번 달 정기런 2회 조건을 달성했습니다.",
    incomplete: "정기런 {remaining}회 더 참여하면 30P"
  },
  {
    key: "monthly_regular_run_5",
    title: "월 5회 이상 정기런 참여",
    points: 50,
    period: "monthly",
    target: 5,
    cta: "이번 달 정기런 5회 조건을 달성했습니다.",
    incomplete: "정기런 {remaining}회 더 참여하면 50P"
  }
];

const REWARD_TIERS = [
  { points: 500, label: "RRC샵 5,000원 보조권" },
  { points: 1000, label: "RRC샵 10,000원 보조권" },
  { points: 2000, label: "RRC샵 20,000원 보조권" }
];

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const state = await buildMissionState(auth);
      return json(200, { ok: true, ...state });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const missionKey = String(body?.mission_key || "").trim();
      const state = await buildMissionState(auth);
      const mission = state.missions.find((item) => item.key === missionKey);
      if (!mission) {
        return json(400, { ok: false, error: "unknown mission" });
      }
      if (mission.disabled) {
        return json(400, { ok: false, error: "mission unavailable" });
      }
      if (mission.claimed) {
        return json(200, { ok: true, status: "already_claimed", ...state });
      }
      if (!mission.claimable) {
        return json(400, { ok: false, error: "mission not ready", mission });
      }

      const rpcResult = await supabaseRpc("claim_activity_mission", {
        p_member_id: auth.user.id,
        p_member_name: auth.profile?.name || auth.user.email || "RRC 회원",
        p_mission_key: mission.key,
        p_period_key: mission.period_key,
        p_points: mission.points,
        p_award_label: mission.award_label,
        p_metadata: {
          source: "activity-missions",
          progress: mission.progress,
          target: mission.target
        }
      });
      const refreshed = await buildMissionState(auth);
      return json(200, {
        ok: true,
        status: rpcResult?.already_claimed ? "already_claimed" : "claimed",
        claim: rpcResult,
        ...refreshed
      });
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

  const rows = await supabaseSelect(`${PROFILE_TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,email,name,role,approval_status&limit=1`);
  const profile = Array.isArray(rows) ? rows[0] || null : null;
  return { ok: profile?.approval_status === "approved", user, profile };
}

async function buildMissionState(auth) {
  const monthKey = currentMonthKeyKst();
  const nameKey = normalizeName(auth.profile?.name || "");
  const [
    claims,
    photos,
    comments,
    challengeEntries,
    attendanceLogs,
    memberRows,
    awards,
    rewardRequests
  ] = await Promise.all([
    supabaseSelect(`${CLAIM_TABLE}?member_id=eq.${encodeURIComponent(auth.user.id)}&select=mission_key,period_key,points,status,claimed_at,created_at&limit=500`).catch(() => []),
    supabaseSelect(`${PHOTO_TABLE}?user_id=eq.${encodeURIComponent(auth.user.id)}&select=id,created_at&limit=1`).catch(() => []),
    supabaseSelect(`${COMMENT_TABLE}?user_id=eq.${encodeURIComponent(auth.user.id)}&select=id,created_at&limit=1`).catch(() => []),
    supabaseSelect(`${CHALLENGE_ENTRY_TABLE}?user_id=eq.${encodeURIComponent(auth.user.id)}&select=id,created_at&limit=1`).catch((error) => {
      if (isMissingTableError(error, CHALLENGE_ENTRY_TABLE)) {
        return null;
      }
      throw error;
    }),
    supabaseSelect(`${ATTENDANCE_TABLE}?select=event_type,attendance_date,matched&attendance_date=gte.${encodeURIComponent(`${monthKey}-01`)}&limit=1000`).catch(() => []),
    supabaseSelect(`${MEMBER_TABLE}?select=name,monthly_runs,is_active&limit=1000`).catch(() => []),
    supabaseSelect(`${AWARD_TABLE}?user_id=eq.${encodeURIComponent(auth.user.id)}&select=points,award_code,month_key,created_at&limit=1000`).catch(() => []),
    supabaseSelect(`${REWARD_TABLE}?user_id=eq.${encodeURIComponent(auth.user.id)}&select=point_cost,status&limit=500`).catch(() => [])
  ]);

  const regularRunCount = countMonthlyRegularRuns({
    attendanceLogs,
    memberRows,
    monthKey,
    nameKey
  });
  const progressByKey = {
    first_activity_visit: 1,
    check_attendance: 1,
    first_photo_upload: Array.isArray(photos) && photos.length ? 1 : 0,
    first_comment: Array.isArray(comments) && comments.length ? 1 : 0,
    first_challenge_join: Array.isArray(challengeEntries) && challengeEntries.length ? 1 : 0,
    monthly_regular_run_2: regularRunCount,
    monthly_regular_run_5: regularRunCount
  };
  const disabledByKey = {
    first_challenge_join: challengeEntries === null
  };
  const claimSet = new Set((Array.isArray(claims) ? claims : []).map((claim) => claimKey(claim.mission_key, claim.period_key)));
  const missions = MISSION_DEFS.map((def) => {
    const periodKey = def.period === "monthly" ? monthKey : "lifetime";
    const progress = Math.min(Number(progressByKey[def.key] || 0), Number(def.target || 1));
    const target = Number(def.target || 1);
    const claimed = claimSet.has(claimKey(def.key, periodKey));
    const disabled = Boolean(disabledByKey[def.key]);
    const complete = progress >= target;
    const remaining = Math.max(target - progress, 0);
    return {
      key: def.key,
      title: def.title,
      points: def.points,
      period_key: periodKey,
      period_type: def.period,
      progress,
      target,
      complete,
      claimed,
      claimable: complete && !claimed && !disabled,
      disabled,
      status: disabled ? "준비 중" : claimed ? "받기 완료" : complete ? "완료" : "미완료",
      helper: disabled
        ? "챌린지 참여 테이블 준비 후 자동 판정됩니다."
        : complete
          ? def.cta
          : def.incomplete.replace("{remaining}", String(remaining)),
      award_label: `미션 포인트 · ${def.title}`
    };
  });
  const totalMissionPoints = missions.reduce((sum, mission) => sum + Number(mission.points || 0), 0);
  const claimedMissionPoints = missions
    .filter((mission) => mission.claimed)
    .reduce((sum, mission) => sum + Number(mission.points || 0), 0);
  const remainingMissionPoints = Math.max(totalMissionPoints - claimedMissionPoints, 0);
  const currentPoints = calculateAvailablePoints({ awards, rewardRequests });
  const reward = getNextReward(currentPoints);

  return {
    month_key: monthKey,
    missions,
    summary: {
      total_mission_points: totalMissionPoints,
      claimed_mission_points: claimedMissionPoints,
      remaining_mission_points: remainingMissionPoints,
      current_points: currentPoints,
      next_reward: reward
    }
  };
}

function countMonthlyRegularRuns({ attendanceLogs, memberRows, monthKey, nameKey }) {
  const logs = Array.isArray(attendanceLogs) ? attendanceLogs : [];
  const regularLogs = logs.filter((log) => {
    const matched = Array.isArray(log?.matched) ? log.matched : [];
    const hasMember = matched.some((name) => normalizeName(name) === nameKey);
    return hasMember && isRegularRun(log?.event_type);
  });
  if (regularLogs.length) {
    return regularLogs.length;
  }

  const member = (Array.isArray(memberRows) ? memberRows : [])
    .filter((row) => row?.is_active !== false)
    .find((row) => normalizeName(row?.name || "") === nameKey);
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {};
  return Number(monthlyRuns[monthKey] || 0);
}

function isRegularRun(eventType) {
  const value = String(eventType || "").toLowerCase();
  return value.includes("정기") || value.includes("regular");
}

function calculateAvailablePoints({ awards, rewardRequests }) {
  const earned = (Array.isArray(awards) ? awards : []).reduce((sum, row) => sum + Number(row.points || 0), 0);
  const usedOrPending = (Array.isArray(rewardRequests) ? rewardRequests : [])
    .filter((row) => ["submitted", "approved", "fulfilled"].includes(String(row.status || "")))
    .reduce((sum, row) => sum + Number(row.point_cost || 0), 0);
  return Math.max(earned - usedOrPending, 0);
}

function getNextReward(points) {
  const current = Number(points || 0);
  const next = REWARD_TIERS.find((tier) => current < tier.points) || null;
  if (!next) {
    return {
      label: "최고 보조권 신청 가능",
      target_points: 2000,
      remaining_points: 0,
      progress_percent: 100
    };
  }
  return {
    label: next.label,
    target_points: next.points,
    remaining_points: Math.max(next.points - current, 0),
    progress_percent: Math.min(Math.round((current / next.points) * 100), 100)
  };
}

function claimKey(missionKey, periodKey) {
  return `${missionKey}:${periodKey}`;
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function currentMonthKeyKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
