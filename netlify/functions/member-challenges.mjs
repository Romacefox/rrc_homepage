const CHALLENGE_TABLE = "member_challenges";
const ENTRY_TABLE = "member_challenge_entries";
const AWARD_TABLE = "member_point_awards";
const REWARD_TABLE = "reward_requests";
const PHOTO_TABLE = "photos";
const COMMENT_TABLE = "photo_comments";
const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";
const MIN_CHALLENGE_PARTICIPANTS = 3;
const PHOTO_POINTS = 5;
const PHOTO_MONTHLY_CAP = 5;
const COMMENT_POINTS = 2;
const COMMENT_MONTHLY_CAP = 10;
const CHALLENGE_MODES = {
  free_intro: {
    label: "무료 입문형",
    entryPoints: 0,
    successRewardPoints: 30,
    failurePolicy: "실패 패널티 없음",
    minParticipants: 1,
    verificationMethod: "RRC 카카오톡 채팅방 인증"
  },
  deposit: {
    label: "소액 예치형",
    entryPoints: 30,
    successRewardPoints: 30,
    failurePolicy: "성공 시 예치 포인트 잠금 해제 + 보너스 지급, 실패 시 운영 기준에 따라 잠금 해제",
    minParticipants: 2,
    verificationMethod: "RRC 카카오톡 채팅방 인증"
  },
  team_goal: {
    label: "팀 달성형",
    entryPoints: 0,
    successRewardPoints: 30,
    failurePolicy: "팀 목표 미달성 시 포인트 차감 없음",
    minParticipants: 3,
    verificationMethod: "RRC 카카오톡 채팅방 인증"
  },
  betting_pool: {
    label: "베팅 분배형",
    entryPoints: 50,
    successRewardPoints: 0,
    failurePolicy: "성공자끼리 참가 포인트를 비율 정산",
    minParticipants: MIN_CHALLENGE_PARTICIPANTS,
    verificationMethod: "RRC 카카오톡 채팅방 인증"
  }
};

export default async (request) => {
  try {
    const auth = await requireApprovedMember(request);
    if (!auth.ok) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 12), 30));
      const advanced = String(url.searchParams.get("advanced") || "") === "1";
      const requestedChallengeId = String(url.searchParams.get("challenge_id") || "").trim();
      const rows = await listChallenges(limit).catch((error) => {
        if (isMissingTableError(error, CHALLENGE_TABLE) || isMissingTableError(error, ENTRY_TABLE)) {
          return null;
        }
        throw error;
      });
      if (!rows) {
        return json(200, { ok: true, available: false, items: [], can_manage: auth.isAdmin });
      }

      const visibleItems = auth.isAdmin || advanced || requestedChallengeId
        ? rows
        : rows.filter((item) => normalizeChallengeMode(item.mode) !== "betting_pool" && (item.status !== "submitted" || item.creator_user_id === auth.user.id));
      return json(200, { ok: true, available: true, items: visibleItems, can_manage: auth.isAdmin });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const title = String(body?.title || "").trim().slice(0, 80);
      const mode = normalizeChallengeMode(body?.mode);
      if (mode === "betting_pool" && !auth.isAdmin) {
        return json(403, { ok: false, error: "advanced challenge mode is admin only" });
      }
      const modeMeta = CHALLENGE_MODES[mode];
      const entryPoints = normalizeChallengePoints(body?.entry_points ?? body?.stake_points, modeMeta.entryPoints, mode === "betting_pool" ? 2000 : 300);
      const successRewardPoints = normalizeChallengePoints(body?.success_reward_points, modeMeta.successRewardPoints, 500);
      const minParticipants = Math.max(1, Math.min(Number(body?.min_participants || modeMeta.minParticipants), 30));
      const failurePolicy = String(body?.failure_policy || modeMeta.failurePolicy).trim().slice(0, 240);
      const verificationMethod = String(body?.verification_method || modeMeta.verificationMethod).trim().slice(0, 120);
      const recruitStartDate = normalizeDate(body?.recruit_start_date);
      const recruitEndDate = normalizeDate(body?.recruit_end_date);
      const startDate = normalizeDate(body?.start_date);
      const endDate = normalizeDate(body?.end_date);
      const verificationTag = String(body?.verification_tag || "").trim().slice(0, 40);
      const ruleText = String(body?.rule_text || "").trim().slice(0, 600);

      if (!title || !startDate || !endDate || !ruleText) {
        return json(400, { ok: false, error: "invalid payload" });
      }
      if (entryPoints > 0 && entryPoints > await calculateAvailablePoints(auth)) {
        return json(400, { ok: false, error: "insufficient points" });
      }
      if ((recruitStartDate && recruitEndDate && recruitEndDate < recruitStartDate) || (recruitEndDate && startDate < recruitEndDate)) {
        return json(400, { ok: false, error: "invalid recruit date range" });
      }
      if (endDate < startDate) {
        return json(400, { ok: false, error: "invalid date range" });
      }

      await insertChallengePayload({
        creator_user_id: auth.user.id,
        creator_name: auth.profile?.name || auth.user.email || "member",
        title,
        mode,
        entry_points: entryPoints,
        success_reward_points: successRewardPoints,
        failure_policy: failurePolicy,
        min_participants: minParticipants,
        verification_method: verificationMethod,
        stake_points: entryPoints,
        recruit_start_date: recruitStartDate || startDate,
        recruit_end_date: recruitEndDate || startDate,
        start_date: startDate,
        end_date: endDate,
        verification_tag: verificationTag,
        kakao_room: "RRC 카카오톡 채팅방",
        rule_text: ruleText,
        status: "recruiting"
      });
      await tryInsertOperationLog(auth, "challenge_create", `${title} / ${mode} / entry ${entryPoints}P`);
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
        const mode = normalizeChallengeMode(challenge.mode);
        const stakePoints = mode === "betting_pool"
          ? Math.max(1, Math.min(Number(body?.stake_points || challenge.entry_points || challenge.stake_points || 0), 2000))
          : Math.max(0, Number(challenge.entry_points ?? challenge.stake_points ?? 0));
        if (!Number.isFinite(stakePoints) || stakePoints < 0) {
          return json(400, { ok: false, error: "invalid stake points" });
        }
        if (stakePoints > 0 && stakePoints > await calculateAvailablePoints(auth)) {
          return json(400, { ok: false, error: "insufficient points" });
        }
        const existingEntry = await loadEntryForUser(challengeId, auth.user.id);
        if (existingEntry) {
          return json(409, { ok: false, error: "already joined" });
        }

        await supabaseInsert(ENTRY_TABLE, {
          challenge_id: challengeId,
          user_id: auth.user.id,
          member_name: auth.profile?.name || auth.user.email || "member",
          stake_points: stakePoints,
          locked_points: stakePoints,
          result: "joined"
        });
        await tryInsertOperationLog(auth, "challenge_join", `${challenge.title} / ${mode} / locked ${stakePoints}P`);
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
        if (status === "settled") {
          return json(400, { ok: false, error: "use settle action" });
        }
        const currentChallenge = await loadChallenge(challengeId);
        if (!currentChallenge) {
          return json(404, { ok: false, error: "challenge not found" });
        }
        if (currentChallenge.status === "settled") {
          return json(400, { ok: false, error: "challenge already settled" });
        }
        await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challengeId)}`, {
          status,
          updated_at: new Date().toISOString()
        });
        if (status === "cancelled" && currentChallenge.status !== "cancelled") {
          await recordChallengeLockRelease(auth, challengeId, "challenge_cancel_return", "챌린지 취소 잠금 해제");
        }
        await tryInsertOperationLog(auth, "challenge_status", `${challengeId}: ${status}`);
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

        return json(200, await settleChallengeByMode(auth, challenge));
      }

      if (action === "delete") {
        const challengeId = String(body?.challenge_id || "").trim();
        const challenge = await loadChallenge(challengeId);
        if (!challenge) {
          return json(404, { ok: false, error: "challenge not found" });
        }
        await supabaseDelete(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challengeId)}`);
        await tryInsertOperationLog(auth, "챌린지 삭제", `${challenge.title} / ${challengeId}`);
        return json(200, { ok: true });
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
  const challenges = await selectChallenges(limit);
  const entries = await selectEntriesForList();
  const entriesByChallenge = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = String(entry.challenge_id || "");
    entriesByChallenge.set(key, [...(entriesByChallenge.get(key) || []), entry]);
  });
  const items = (Array.isArray(challenges) ? challenges : []).map((challenge) => ({
    ...challenge,
    entries: entriesByChallenge.get(String(challenge.id || "")) || []
  }));
  await autoTransitionChallenges(items);
  return items;
}

async function selectChallenges(limit) {
  const withModes = `${CHALLENGE_TABLE}?order=created_at.desc&limit=${limit}&select=id,creator_user_id,creator_name,title,mode,entry_points,success_reward_points,failure_policy,min_participants,verification_method,progress_current,progress_target,stake_points,recruit_start_date,recruit_end_date,start_date,end_date,verification_tag,kakao_room,rule_text,status,payout_points,created_at,updated_at,settled_at`;
  const withRecruitDates = `${CHALLENGE_TABLE}?order=created_at.desc&limit=${limit}&select=id,creator_user_id,creator_name,title,stake_points,recruit_start_date,recruit_end_date,start_date,end_date,verification_tag,kakao_room,rule_text,status,payout_points,created_at,updated_at,settled_at`;
  const legacy = `${CHALLENGE_TABLE}?order=created_at.desc&limit=${limit}&select=id,creator_user_id,creator_name,title,stake_points,start_date,end_date,verification_tag,kakao_room,rule_text,status,payout_points,created_at,updated_at,settled_at`;
  try {
    return await supabaseSelect(withModes);
  } catch (error) {
    if (!isMissingAnyColumnError(error, ["mode", "entry_points", "success_reward_points", "failure_policy", "min_participants", "verification_method", "progress_current", "progress_target"])) {
      throw error;
    }
  }
  try {
    return await supabaseSelect(withRecruitDates);
  } catch (error) {
    if (isMissingColumnError(error, "recruit_start_date") || isMissingColumnError(error, "recruit_end_date")) {
      return supabaseSelect(legacy);
    }
    throw error;
  }
}

async function selectEntriesForList() {
  const withLocked = `${ENTRY_TABLE}?order=created_at.asc&limit=500&select=id,challenge_id,user_id,member_name,stake_points,locked_points,result,payout_points,created_at,judged_at,settled_at`;
  const legacy = `${ENTRY_TABLE}?order=created_at.asc&limit=500&select=id,challenge_id,user_id,member_name,stake_points,result,payout_points,created_at,judged_at`;
  try {
    return await supabaseSelect(withLocked);
  } catch (error) {
    if (isMissingColumnError(error, "locked_points") || isMissingColumnError(error, "settled_at")) {
      return supabaseSelect(legacy);
    }
    throw error;
  }
}

async function autoTransitionChallenges(items) {
  const today = todayKstDateKey();
  for (const item of Array.isArray(items) ? items : []) {
    if (item.status !== "recruiting") {
      continue;
    }
    const recruitEnd = item.recruit_end_date || item.start_date;
    if (!recruitEnd || today <= recruitEnd) {
      continue;
    }
    const minParticipants = Math.max(1, Number(item.min_participants || MIN_CHALLENGE_PARTICIPANTS));
    const nextStatus = (Array.isArray(item.entries) ? item.entries.length : 0) >= minParticipants
      ? "in_progress"
      : "cancelled";
    await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(item.id)}`, {
      status: nextStatus,
      updated_at: new Date().toISOString()
    });
    item.status = nextStatus;
  }
}

async function loadChallenge(id) {
  if (!id) {
    return null;
  }
  const withModes = `${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(id)}&select=id,title,mode,entry_points,success_reward_points,failure_policy,min_participants,verification_method,stake_points,status,end_date&limit=1`;
  const legacy = `${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(id)}&select=id,title,stake_points,status,end_date&limit=1`;
  try {
    const rows = await supabaseSelect(withModes);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    if (!isMissingAnyColumnError(error, ["mode", "entry_points", "success_reward_points", "failure_policy", "min_participants", "verification_method"])) {
      throw error;
    }
  }
  const rows = await supabaseSelect(legacy);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadEntries(challengeId) {
  const withLocked = `${ENTRY_TABLE}?challenge_id=eq.${encodeURIComponent(challengeId)}&select=id,user_id,member_name,stake_points,locked_points,result,payout_points`;
  const legacy = `${ENTRY_TABLE}?challenge_id=eq.${encodeURIComponent(challengeId)}&select=id,user_id,member_name,stake_points,result,payout_points`;
  try {
    return await supabaseSelect(withLocked);
  } catch (error) {
    if (isMissingColumnError(error, "locked_points")) {
      return supabaseSelect(legacy);
    }
    throw error;
  }
}

async function loadEntryForUser(challengeId, userId) {
  const rows = await supabaseSelect(`${ENTRY_TABLE}?challenge_id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function settleChallengeByMode(auth, challenge) {
  const mode = normalizeChallengeMode(challenge.mode);
  const entries = await loadEntries(challenge.id);
  const successEntries = mode === "team_goal"
    ? entries
    : entries.filter((entry) => entry.result === "success");
  const settlementMonthKey = monthKeyFromDate(challenge.end_date || new Date().toISOString());

  if (mode === "betting_pool") {
    return settleBettingPoolChallenge(auth, challenge, entries, successEntries, settlementMonthKey);
  }

  const rewardPoints = Math.max(0, Number(challenge.success_reward_points || CHALLENGE_MODES[mode].successRewardPoints || 0));
  let payoutTotal = 0;
  for (const entry of entries) {
    const isSuccess = mode === "team_goal" || entry.result === "success";
    const payoutPoints = isSuccess ? rewardPoints : 0;
    payoutTotal += payoutPoints;
    await supabasePatch(`${ENTRY_TABLE}?id=eq.${encodeURIComponent(entry.id)}`, {
      payout_points: payoutPoints,
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (Number(entry.locked_points || entry.stake_points || 0) > 0) {
      await tryInsertPointAward(auth, {
        userId: entry.user_id,
        memberName: entry.member_name,
        monthKey: settlementMonthKey,
        awardCode: "challenge_lock_release",
        awardLabel: `챌린지 잠금 해제: ${challenge.title}`.slice(0, 80),
        points: 0,
        note: `잠금 ${Number(entry.locked_points || entry.stake_points || 0)}P 해제`
      });
    }
    if (payoutPoints > 0) {
      await tryInsertPointAward(auth, {
        userId: entry.user_id,
        memberName: entry.member_name,
        monthKey: settlementMonthKey,
        awardCode: "challenge_reward",
        awardLabel: `챌린지 성공 보상: ${challenge.title}`.slice(0, 80),
        points: payoutPoints,
        note: `${getChallengeModeLabel(mode)} 성공 보상 ${payoutPoints}P`
      });
    }
  }

  await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challenge.id)}`, {
    status: "settled",
    payout_points: payoutTotal,
    settled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  await tryInsertOperationLog(auth, "challenge_settle", `${challenge.title}: ${mode} / success ${successEntries.length} / payout ${payoutTotal}P`);
  return { ok: true, success_count: successEntries.length, payout_points: payoutTotal, payout_total: payoutTotal, pot_points: 0 };
}

async function settleBettingPoolChallenge(auth, challenge, entries, successEntries, settlementMonthKey) {
  const pot = entries.reduce((sum, entry) => sum + Number(entry.stake_points || 0), 0);
  const payoutMap = allocateProportionalPayouts(successEntries, pot);
  const payoutTotal = [...payoutMap.values()].reduce((sum, points) => sum + points, 0);

  for (const entry of entries) {
    const payoutPoints = entry.result === "success" ? Number(payoutMap.get(String(entry.id)) || 0) : 0;
    await supabasePatch(`${ENTRY_TABLE}?id=eq.${encodeURIComponent(entry.id)}`, {
      payout_points: payoutPoints,
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  for (const entry of entries) {
    const stakePoints = Number(entry.stake_points || 0);
    await tryInsertPointAward(auth, {
      userId: entry.user_id,
      memberName: entry.member_name,
      monthKey: settlementMonthKey,
      awardCode: "challenge_stake",
      awardLabel: `챌린지 베팅 차감: ${challenge.title}`.slice(0, 80),
      points: -stakePoints,
      note: `챌린지 참가 베팅 ${stakePoints}P 차감`
    });
  }
  for (const entry of successEntries) {
    const payoutPoints = Number(payoutMap.get(String(entry.id)) || 0);
    await tryInsertPointAward(auth, {
      userId: entry.user_id,
      memberName: entry.member_name,
      monthKey: settlementMonthKey,
      awardCode: "challenge_payout",
      awardLabel: `챌린지 성공: ${challenge.title}`.slice(0, 80),
      points: payoutPoints,
      note: `참가 팟 ${pot}P / 내 베팅 ${Number(entry.stake_points || 0)}P / 성공자 베팅 비율 정산`
    });
  }
  await supabasePatch(`${CHALLENGE_TABLE}?id=eq.${encodeURIComponent(challenge.id)}`, {
    status: "settled",
    payout_points: payoutTotal,
    settled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  await tryInsertOperationLog(auth, "challenge_settle", `${challenge.title}: betting_pool / success ${successEntries.length} / payout ${payoutTotal}P`);
  return { ok: true, success_count: successEntries.length, payout_points: payoutTotal, payout_total: payoutTotal, pot_points: pot };
}

async function recordChallengeLockRelease(auth, challengeId, awardCode, awardLabel) {
  const challenge = await loadChallenge(challengeId);
  const entries = await loadEntries(challengeId).catch(() => []);
  const monthKey = monthKeyFromDate(challenge?.end_date || new Date().toISOString());
  for (const entry of entries) {
    const lockedPoints = Number(entry.locked_points || entry.stake_points || 0);
    if (lockedPoints <= 0) {
      continue;
    }
    await tryInsertPointAward(auth, {
      userId: entry.user_id,
      memberName: entry.member_name,
      monthKey,
      awardCode,
      awardLabel: `${awardLabel}: ${challenge?.title || "챌린지"}`.slice(0, 80),
      points: 0,
      note: `잠금 ${lockedPoints}P 해제`
    });
  }
}

async function insertChallengePayload(payload) {
  try {
    await supabaseInsert(CHALLENGE_TABLE, payload);
  } catch (error) {
    const fallbackColumns = [
      "recruit_start_date",
      "recruit_end_date",
      "mode",
      "entry_points",
      "success_reward_points",
      "failure_policy",
      "min_participants",
      "verification_method",
      "progress_current",
      "progress_target"
    ];
    if (!fallbackColumns.some((column) => isMissingColumnError(error, column))) {
      throw error;
    }
    const {
      recruit_start_date: _recruitStart,
      recruit_end_date: _recruitEnd,
      mode: _mode,
      entry_points: _entryPoints,
      success_reward_points: _successRewardPoints,
      failure_policy: _failurePolicy,
      min_participants: _minParticipants,
      verification_method: _verificationMethod,
      progress_current: _progressCurrent,
      progress_target: _progressTarget,
      ...legacyPayload
    } = payload;
    await supabaseInsert(CHALLENGE_TABLE, legacyPayload);
  }
}

async function calculateAvailablePoints(auth) {
  const userId = String(auth.user?.id || "");
  const [awards, rewards, entries, photos, comments] = await Promise.all([
    supabaseSelect(`${AWARD_TABLE}?or=(user_id.eq.${encodeURIComponent(userId)},member_name.eq.${encodeURIComponent(auth.profile?.name || "")})&select=award_code,points`).catch(() => []),
    supabaseSelect(`${REWARD_TABLE}?user_id=eq.${encodeURIComponent(userId)}&status=in.(submitted,approved,fulfilled)&select=point_cost,status`).catch(() => []),
    supabaseSelect(`${ENTRY_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=stake_points,locked_points,challenge_id`).catch(() => []),
    supabaseSelect(`${PHOTO_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=created_at&limit=1000`).catch(() => []),
    supabaseSelect(`${COMMENT_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=created_at&limit=1000`).catch(() => [])
  ]);
  const earned = (Array.isArray(awards) ? awards : []).reduce((sum, row) => sum + Number(row.points || 0), 0);
  const hasSignupBonus = (Array.isArray(awards) ? awards : []).some((row) => row.award_code === "signup_bonus");
  const signupBonus = hasSignupBonus ? 0 : 20;
  const photoPoints = countMonthlyCappedDailyEvents(photos, PHOTO_MONTHLY_CAP) * PHOTO_POINTS;
  const commentPoints = countMonthlyCappedDailyEvents(comments, COMMENT_MONTHLY_CAP) * COMMENT_POINTS;
  const used = (Array.isArray(rewards) ? rewards : []).reduce((sum, row) => sum + Number(row.point_cost || 0), 0);
  const activeChallengeIds = await loadActiveChallengeIds();
  const locked = (Array.isArray(entries) ? entries : [])
    .filter((entry) => activeChallengeIds.has(String(entry.challenge_id || "")))
    .reduce((sum, entry) => sum + Number(entry.locked_points ?? entry.stake_points ?? 0), 0);
  return Math.max(earned + signupBonus + photoPoints + commentPoints - used - locked, 0);
}

async function loadActiveChallengeIds() {
  const rows = await supabaseSelect(`${CHALLENGE_TABLE}?status=in.(submitted,recruiting,in_progress,judging)&select=id&limit=500`).catch(() => []);
  return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.id || "")).filter(Boolean));
}

function allocateProportionalPayouts(successEntries, pot) {
  const entries = Array.isArray(successEntries) ? successEntries : [];
  const totalStake = entries.reduce((sum, entry) => sum + Number(entry.stake_points || 0), 0);
  const totalPot = Math.max(0, Math.floor(Number(pot || 0)));
  const payouts = new Map();
  if (!entries.length || totalStake <= 0 || totalPot <= 0) {
    entries.forEach((entry) => payouts.set(String(entry.id), 0));
    return payouts;
  }

  const shares = entries.map((entry) => {
    const raw = totalPot * (Number(entry.stake_points || 0) / totalStake);
    const floor = Math.floor(raw);
    return {
      id: String(entry.id),
      memberName: String(entry.member_name || ""),
      stake: Number(entry.stake_points || 0),
      floor,
      remainder: raw - floor
    };
  });
  let distributed = shares.reduce((sum, share) => sum + share.floor, 0);
  shares.forEach((share) => payouts.set(share.id, share.floor));

  shares
    .sort((a, b) => (b.remainder - a.remainder) || (b.stake - a.stake) || a.memberName.localeCompare(b.memberName, "ko"))
    .forEach((share) => {
      if (distributed >= totalPot) {
        return;
      }
      payouts.set(share.id, Number(payouts.get(share.id) || 0) + 1);
      distributed += 1;
    });

  return payouts;
}

function normalizeDate(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : "";
}

function normalizeChallengeMode(value) {
  const mode = String(value || "").trim();
  if (["free_intro", "deposit", "team_goal", "betting_pool"].includes(mode)) {
    return mode;
  }
  return "betting_pool";
}

function normalizeChallengePoints(value, fallback, max) {
  const raw = Number(value);
  const base = Number.isFinite(raw) ? raw : Number(fallback || 0);
  return Math.max(0, Math.min(Math.floor(base), Number(max || 2000)));
}

function getChallengeModeLabel(mode) {
  return CHALLENGE_MODES[normalizeChallengeMode(mode)]?.label || "챌린지";
}

function countMonthlyCappedDailyEvents(rows, monthlyCap) {
  const daysByMonth = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const monthKey = toMonthKey(row.created_at);
    const dayKey = toDateKey(row.created_at);
    if (!monthKey || !dayKey) {
      return;
    }
    const days = daysByMonth.get(monthKey) || new Set();
    days.add(dayKey);
    daysByMonth.set(monthKey, days);
  });
  return [...daysByMonth.values()].reduce((sum, days) => sum + Math.min(days.size, Number(monthlyCap || 0)), 0);
}

function toMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKstDateKey() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
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

function isMissingColumnError(error, column) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes(String(column || "").toLowerCase()) && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find"));
}

function isMissingAnyColumnError(error, columns) {
  return (Array.isArray(columns) ? columns : []).some((column) => isMissingColumnError(error, column));
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
