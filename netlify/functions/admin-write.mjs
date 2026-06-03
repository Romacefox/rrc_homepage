const PROFILE_TABLE = "member_profiles";
const LOG_TABLE = "operation_logs";
const ATTENDANCE_RPC_NAME = "admin_attendance_mutation";
const DEFAULT_WINNER_COUNT = 4;
const DEFAULT_THRESHOLD = 5;
const WINTER_THRESHOLD = 4;
const WINTER_MONTHS = [12, 1, 2];
const BIRTH_YEAR_MIN = 1989;
const BIRTH_YEAR_MAX = 2004;

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
      if (birthYear < BIRTH_YEAR_MIN || birthYear > BIRTH_YEAR_MAX) {
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
      if (birthYear < BIRTH_YEAR_MIN || birthYear > BIRTH_YEAR_MAX) {
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

    if (action === "delete_member") {
      const memberId = String(body?.member_id || "").trim();
      const name = String(body?.name || "").trim();
      const birthYear = Number(body?.birth_year || 0);
      if (!memberId && !name) {
        return json(400, { ok: false, error: "missing member target" });
      }

      const members = await loadMembers();
      const memberResult = findMemberForDeletion(members, { memberId, name, birthYear });
      if (memberResult.ambiguous) {
        return json(409, {
          ok: false,
          error: "member target is ambiguous",
          candidates: memberResult.candidates
        });
      }
      const member = memberResult.member;
      if (!member) {
        return json(404, { ok: false, error: "member not found" });
      }

      const deletedMembers = await supabaseDeleteReturning(`members?id=eq.${encodeURIComponent(member.id)}&select=id,name`);
      if (!Array.isArray(deletedMembers) || deletedMembers.length < 1) {
        return json(409, {
          ok: false,
          error: "member delete did not affect any rows",
          target: { id: member.id, name: member.name, birth_year: member.birth_year }
        });
      }
      const stillExists = await loadMemberById(member.id);
      if (stillExists) {
        return json(409, {
          ok: false,
          error: "member still exists after delete",
          target: { id: member.id, name: member.name, birth_year: member.birth_year }
        });
      }
      await tryInsertOperationLog(auth, "member_delete", `${member.name} (${member.birth_year || ""})`);
      return json(200, { ok: true, message: "member deleted", deleted_member: { id: member.id, name: member.name } });
    }

    if (action === "run_raffle") {
      const targetMonthKey = normalizeMonthKey(body?.target_month_key) || previousMonthKey(new Date());
      const threshold = Math.max(1, Number(body?.threshold || thresholdForMonthKey(targetMonthKey)));
      const winnerCount = Math.max(1, Math.min(Number(body?.winner_count || DEFAULT_WINNER_COUNT), 20));
      const forceRedraw = body?.force === true;
      const existingDraws = await supabaseSelect(`raffle_history?target_month_key=eq.${encodeURIComponent(targetMonthKey)}&select=draw_id&limit=1`);
      if (Array.isArray(existingDraws) && existingDraws.length > 0) {
        if (!forceRedraw) {
          return json(409, { ok: false, error: "raffle already drawn for target month" });
        }
        await supabaseDelete(`raffle_history?target_month_key=eq.${encodeURIComponent(targetMonthKey)}`);
      }
      const members = await loadMembers();
      const candidates = members.filter((member) => (
        member.is_active !== false
        && monthlyRunsOf(member, targetMonthKey) >= threshold
      ));
      const winners = pickWinners(candidates, winnerCount).map((member) => ({
        id: member.id,
        name: member.name,
        runs: monthlyRunsOf(member, targetMonthKey)
      }));
      const createdAt = new Date().toISOString();
      const record = {
        draw_id: `manual-${targetMonthKey}-${Date.now()}`,
        target_month_key: targetMonthKey,
        threshold,
        winner_count: winnerCount,
        winners,
        created_at: createdAt
      };

      await supabaseInsert("raffle_history", {
        draw_id: record.draw_id,
        target_month_key: record.target_month_key,
        threshold: record.threshold,
        winner_count: record.winner_count,
        winners: record.winners
      });
      await supabaseInsert("notices", {
        title: `${labelMonth(targetMonthKey)} 참여 추첨 결과`,
        content: winners.length
          ? `${winners.map((winner) => winner.name).join(", ")}님 축하합니다!`
          : `기준(${threshold}회 이상)을 충족한 회원이 없어 당첨자가 없습니다.`
      });
      await tryInsertOperationLog(auth, "raffle_manual_draw", `${targetMonthKey}: ${winners.map((winner) => winner.name).join(", ") || "no winner"}`);
      return json(200, { ok: true, message: "raffle drawn", record, candidate_count: candidates.length });
    }

    if (action === "preview_raffle") {
      const targetMonthKey = normalizeMonthKey(body?.target_month_key) || previousMonthKey(new Date());
      const threshold = Math.max(1, Number(body?.threshold || thresholdForMonthKey(targetMonthKey)));
      const existingDraws = await supabaseSelect(`raffle_history?target_month_key=eq.${encodeURIComponent(targetMonthKey)}&select=draw_id&limit=1`);
      const members = await loadMembers();
      const candidates = members
        .filter((member) => (
          member.is_active !== false
          && monthlyRunsOf(member, targetMonthKey) >= threshold
        ))
        .sort((a, b) => monthlyRunsOf(b, targetMonthKey) - monthlyRunsOf(a, targetMonthKey) || String(a.name || "").localeCompare(String(b.name || ""), "ko"))
        .map((member) => ({
          id: member.id,
          name: member.name,
          runs: monthlyRunsOf(member, targetMonthKey)
        }));
      return json(200, {
        ok: true,
        target_month_key: targetMonthKey,
        threshold,
        already_drawn: Array.isArray(existingDraws) && existingDraws.length > 0,
        candidate_count: candidates.length,
        candidates
      });
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

    if (action === "bulk_update_member_fee_status") {
      const memberIds = Array.isArray(body?.member_ids) ? body.member_ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
      const memberRefs = Array.isArray(body?.member_refs) ? body.member_refs.map(normalizeMemberRef).filter((ref) => ref.key) : [];
      const monthKey = String(body?.month_key || "").trim();
      const status = String(body?.status || "").trim();
      if ((!memberIds.length && !memberRefs.length) || !monthKey || !["paid", "unpaid"].includes(status)) {
        return json(400, { ok: false, error: "invalid bulk fee payload" });
      }

      const targetIds = new Set(memberIds.slice(0, 500));
      const targetKeys = new Set(memberRefs.slice(0, 500).map((ref) => ref.key));
      const members = await loadMembers();
      let updatedCount = 0;
      for (const member of members) {
        const memberKey = memberIdentityKey(member);
        if (!targetIds.has(String(member.id)) && !targetKeys.has(memberKey)) {
          continue;
        }
        const feeStatus = member?.fee_status && typeof member.fee_status === "object"
          ? member.fee_status
          : {};
        await supabasePatch(`members?id=eq.${encodeURIComponent(member.id)}`, {
          fee_status: { ...feeStatus, [monthKey]: status }
        });
        updatedCount += 1;
      }

      await tryInsertOperationLog(auth, "fee_status_bulk_update", `${monthKey}:${status}:${updatedCount}`);
      return json(200, { ok: true, message: "member fees updated", updated_count: updatedCount });
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
      const eventType = normalizeAttendanceEventType(body?.event_type);
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

    if (action === "append_attendance_member") {
      const name = String(body?.name || "").trim();
      const attendanceDate = String(body?.date || "").trim();
      const eventType = normalizeAttendanceEventType(body?.event_type);
      const source = String(body?.source || "quick").trim() || "quick";
      if (!name || !attendanceDate) {
        return json(400, { ok: false, error: "missing attendance payload" });
      }

      const rpcResult = await tryAttendanceMutationRpc({
        action,
        name,
        date: attendanceDate,
        event_type: eventType,
        source
      });
      if (rpcResult) {
        await tryInsertOperationLog(auth, "attendance_append", `${attendanceDate} ${eventType} ${name}`);
        return json(200, rpcResult);
      }

      return json(200, await appendAttendanceMemberFallback(auth, { name, attendanceDate, eventType, source }));
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
      const eventType = normalizeAttendanceEventType(body?.event_type || existingLog.event_type);
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
      const attendanceDate = String(body?.date || "").trim();
      const eventType = String(body?.event_type || "").trim();
      const source = String(body?.source || "bulk").trim() || "bulk";
      const matched = Array.isArray(body?.matched) ? body.matched.map((name) => String(name || "").trim()).filter(Boolean) : [];
      if (!logId && (!attendanceDate || !eventType)) {
        return json(400, { ok: false, error: "missing attendance log target" });
      }

      return json(200, await revertAttendanceFallback(auth, { logId, attendanceDate, eventType, source, matched }));
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
  const conflictingLogs = findAttendanceLogsByScope(existingLogs, attendanceDate, eventType);

  for (const log of conflictingLogs) {
    await revertAttendanceMatches(log, members, monthKeyFromDate(log.attendance_date || attendanceDate));
    await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(log.id)}`);
  }

  const summary = await createAttendanceLogRecord({ names, uniqueNames, members, attendanceDate, eventType, source, monthKey });
  summary.summary.replaced_existing = conflictingLogs.length > 0;
  await tryInsertOperationLog(auth, "attendance_apply", `${attendanceDate} ${eventType} / ${summary.summary.matched.length}`);
  return summary;
}

async function appendAttendanceMemberFallback(auth, { name, attendanceDate, eventType, source }) {
  const members = await loadMembers();
  const monthKey = monthKeyFromDate(attendanceDate);
  const result = findMemberByName(name, members);
  if (result.type === "ambiguous") {
    return {
      ok: true,
      summary: { matched: [], unmatched: [], ambiguous: [name], already_present: [] }
    };
  }
  if (result.type !== "unique") {
    return {
      ok: true,
      summary: { matched: [], unmatched: [name], ambiguous: [], already_present: [] }
    };
  }

  const logs = await loadAttendanceLogs();
  const sameScopeLogs = findAttendanceLogsByScope(logs, attendanceDate, eventType);
  const alreadyPresent = sameScopeLogs.some((log) => (
    (Array.isArray(log?.matched) ? log.matched : []).some((matchedName) => normalizeName(matchedName) === normalizeName(result.member.name))
  ));
  if (alreadyPresent) {
    return {
      ok: true,
      summary: { matched: [], unmatched: [], ambiguous: [], already_present: [result.member.name] }
    };
  }

  const existingLog = sameScopeLogs[0] || null;
  const matched = Array.isArray(existingLog?.matched) ? existingLog.matched : [];
  await updateMemberRuns(result.member, 1, monthKey);
  if (existingLog) {
    await supabasePatch(`attendance_logs?id=eq.${encodeURIComponent(existingLog.id)}`, {
      matched: [...matched, result.member.name],
      raw_count: Number(existingLog.raw_count || matched.length || 0) + 1
    });
  } else {
    await supabaseInsert("attendance_logs", {
      source: source.slice(0, 20),
      event_type: eventType.slice(0, 20),
      attendance_date: attendanceDate,
      raw_count: 1,
      matched: [result.member.name],
      unmatched: [],
      ambiguous: [],
      created_at: new Date().toISOString()
    });
  }
  await tryInsertOperationLog(auth, "attendance_append", `${attendanceDate} ${eventType} / ${result.member.name}`);
  return {
    ok: true,
    summary: { matched: [result.member.name], unmatched: [], ambiguous: [], already_present: [] }
  };
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
  const conflictingLogs = existingLogs.filter((entry) => (
    String(entry?.id || "") !== String(logId)
    && String(entry?.attendance_date || "") === attendanceDate
    && String(entry?.event_type || "") === eventType
  ));

  await revertAttendanceMatches(existingLog, members, monthKeyFromDate(existingLog.attendance_date));
  await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(existingLog.id)}`);

  for (const conflictingLog of conflictingLogs) {
    await revertAttendanceMatches(conflictingLog, members, monthKeyFromDate(conflictingLog.attendance_date));
    await supabaseDelete(`attendance_logs?id=eq.${encodeURIComponent(conflictingLog.id)}`);
  }

  const summary = await createAttendanceLogRecord({ names, uniqueNames, members, attendanceDate, eventType, source, monthKey });
  summary.summary.replaced_existing = true;
  await tryInsertOperationLog(auth, "attendance_replace", `${attendanceDate} ${eventType} / ${summary.summary.matched.length}`);
  return summary;
}

async function revertAttendanceFallback(auth, { logId, attendanceDate = "", eventType = "", source = "bulk", matched = [] }) {
  let log = logId ? await loadAttendanceLogById(logId) : null;
  if (!log && attendanceDate) {
    const logs = await loadAttendanceLogs();
    log = findAttendanceLogForRevert(logs, { attendanceDate, eventType, source, matched }) || null;
  }
  if (!log) {
    if (attendanceDate && matched.length) {
      const members = await loadMembers();
      const manualLog = {
        attendance_date: attendanceDate,
        event_type: eventType || "attendance",
        matched
      };
      await revertAttendanceMatches(manualLog, members, monthKeyFromDate(attendanceDate));
      await tryInsertOperationLog(auth, "attendance_revert_manual", `${attendanceDate} ${eventType || ""} / ${matched.length}`);
      return { ok: true, message: "attendance reverted by matched names", mode: "manual_without_log" };
    }
    throw new Error("attendance log not found");
  }

  const deletedLogs = await supabaseDeleteReturning(`attendance_logs?id=eq.${encodeURIComponent(log.id)}&select=id`);
  if (!Array.isArray(deletedLogs) || deletedLogs.length < 1) {
    return {
      ok: false,
      error: "attendance log delete did not affect any rows",
      target: {
        id: log.id,
        attendance_date: log.attendance_date,
        event_type: log.event_type
      }
    };
  }
  const stillExists = await loadAttendanceLogById(log.id);
  if (stillExists) {
    return {
      ok: false,
      error: "attendance log still exists after delete",
      target: {
        id: log.id,
        attendance_date: log.attendance_date,
        event_type: log.event_type
      }
    };
  }
  const members = await loadMembers();
  await revertAttendanceMatches(log, members, monthKeyFromDate(log.attendance_date));
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
  if (!memberId) {
    return null;
  }
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

async function loadMemberByIdentity(name, birthYear) {
  const normalizedName = normalizeName(name);
  const normalizedBirthYear = Number(birthYear || 0);
  if (!normalizedName) {
    return null;
  }
  const members = await loadMembers();
  const exact = members.find((member) => (
    normalizeName(member.name) === normalizedName
    && Number(member.birth_year || 0) === normalizedBirthYear
  ));
  if (exact) {
    return exact;
  }
  if (normalizedBirthYear) {
    return null;
  }
  const sameName = members.filter((member) => normalizeName(member.name) === normalizedName);
  return sameName.length === 1 ? sameName[0] : null;
}

async function loadAttendanceLogs() {
  return supabaseSelect("attendance_logs?select=id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at&order=created_at.desc&limit=1000");
}

async function loadAttendanceLogById(logId) {
  const rows = await supabaseSelect(`attendance_logs?id=eq.${encodeURIComponent(logId)}&select=id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at&limit=1`);
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

function findAttendanceLogByScope(logs, attendanceDate, eventType, source = "") {
  return (Array.isArray(logs) ? logs : []).find((entry) => (
    String(entry?.attendance_date || "") === String(attendanceDate || "")
    && String(entry?.event_type || "") === String(eventType || "")
    && (!source || String(entry?.source || "bulk") === String(source || "bulk"))
  )) || null;
}

function findAttendanceLogsByScope(logs, attendanceDate, eventType, source = "") {
  return (Array.isArray(logs) ? logs : []).filter((entry) => (
    String(entry?.attendance_date || "") === String(attendanceDate || "")
    && String(entry?.event_type || "") === String(eventType || "")
    && (!source || String(entry?.source || "bulk") === String(source || "bulk"))
  ));
}

function findAttendanceLogForRevert(logs, { attendanceDate, eventType, source, matched = [] }) {
  const sameDate = (Array.isArray(logs) ? logs : []).filter((entry) => (
    String(entry?.attendance_date || "") === String(attendanceDate || "")
  ));
  if (!sameDate.length) {
    return null;
  }

  const matchedKeys = new Set((Array.isArray(matched) ? matched : []).map(normalizeName).filter(Boolean));
  const targetEventType = normalizeLoose(eventType);
  const targetSource = normalizeLoose(source || "bulk");
  const scored = sameDate.map((entry) => {
    const entryKeys = new Set((Array.isArray(entry?.matched) ? entry.matched : []).map(normalizeName).filter(Boolean));
    const overlap = [...matchedKeys].filter((key) => entryKeys.has(key)).length;
    const exactNames = matchedKeys.size > 0
      && entryKeys.size === matchedKeys.size
      && [...matchedKeys].every((key) => entryKeys.has(key));
    const eventScore = targetEventType && normalizeLoose(entry?.event_type) === targetEventType ? 40 : 0;
    const sourceScore = targetSource && normalizeLoose(entry?.source || "bulk") === targetSource ? 10 : 0;
    const exactScore = exactNames ? 80 : 0;
    const overlapScore = overlap * 12;
    const hasNameSignal = matchedKeys.size > 0 ? overlapScore + exactScore : 0;
    const createdAt = Date.parse(entry?.created_at || "") || 0;
    return {
      entry,
      score: eventScore + sourceScore + hasNameSignal,
      overlap,
      createdAt
    };
  }).sort((a, b) => (
    b.score - a.score
    || b.overlap - a.overlap
    || b.createdAt - a.createdAt
  ));

  const best = scored[0];
  if (!best) {
    return null;
  }
  if (matchedKeys.size && best.overlap === 0 && targetEventType) {
    const eventMatch = scored.find((item) => normalizeLoose(item.entry?.event_type) === targetEventType);
    return eventMatch?.entry || best.entry;
  }
  return best.entry;
}

function findMemberForDeletion(members, { memberId, name, birthYear }) {
  const allMembers = Array.isArray(members) ? members : [];
  const byId = memberId
    ? allMembers.find((member) => String(member?.id || "") === String(memberId))
    : null;
  if (byId) {
    return { member: byId, ambiguous: false, candidates: [] };
  }

  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return { member: null, ambiguous: false, candidates: [] };
  }

  const sameName = allMembers.filter((member) => normalizeName(member?.name) === normalizedName);
  if (birthYear) {
    const exact = sameName.find((member) => Number(member?.birth_year || 0) === birthYear);
    if (exact) {
      return { member: exact, ambiguous: false, candidates: [] };
    }
  }
  if (sameName.length === 1) {
    return { member: sameName[0], ambiguous: false, candidates: [] };
  }
  if (sameName.length > 1) {
    return {
      member: null,
      ambiguous: true,
      candidates: sameName.map((member) => ({
        id: member.id,
        name: member.name,
        birth_year: member.birth_year
      }))
    };
  }
  return { member: null, ambiguous: false, candidates: [] };
}

function normalizeLoose(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
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

function normalizeMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function previousMonthKey(date) {
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function thresholdForMonthKey(monthKey) {
  const month = Number(String(monthKey || "").split("-")[1] || 0);
  return WINTER_MONTHS.includes(month) ? WINTER_THRESHOLD : DEFAULT_THRESHOLD;
}

function monthlyRunsOf(member, monthKey) {
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object"
    ? member.monthly_runs
    : {};
  return Number(monthlyRuns[monthKey] || 0);
}

function pickWinners(candidates, count) {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function labelMonth(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  return `${year}년 ${month}월`;
}

function normalizeAttendanceEventType(value) {
  const raw = String(value || "").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (!raw || compact === "regular" || raw.includes("정기")) {
    return "정기런";
  }
  if (compact === "flash" || raw.includes("번개")) {
    return "번개런";
  }
  if (compact === "official" || raw.includes("공식")) {
    return "공식 행사";
  }
  return raw.slice(0, 20);
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function normalizeMemberRef(ref) {
  const name = String(ref?.name || "").trim();
  const birthYear = Number(ref?.birth_year || ref?.birthYear || 0);
  return {
    name,
    birthYear,
    key: `${normalizeName(name)}|${birthYear || ""}`
  };
}

function memberIdentityKey(member) {
  return `${normalizeName(member?.name || "")}|${Number(member?.birth_year || 0) || ""}`;
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

async function supabaseDeleteReturning(path) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
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

async function tryAttendanceMutationRpc(payload, options = {}) {
  try {
    const result = await supabaseRpc(ATTENDANCE_RPC_NAME, { payload });
    return result && typeof result === "object" ? result : null;
  } catch (error) {
    if (isMissingFunctionError(error, ATTENDANCE_RPC_NAME)) {
      return null;
    }
    if (options.allowNotFoundFallback && isRpcNotFoundError(error)) {
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

function isRpcNotFoundError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("p0001") || message.includes("not found");
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
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
