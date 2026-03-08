
const STORAGE_KEY = "rrc-site-db-v3";
const ADMIN_PASSWORD = "RRC_Admin_2026!Seoul";
const WINTER_MONTHS = [12, 1, 2];
const DRAW_WINNER_COUNT = 4;
const MONTHLY_FEE = 5000;
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const PHOTO_BUCKET = "rrc-photos";

const defaultData = {
  notices: [
    {
      id: makeId(),
      title: "RRC 홈페이지 오픈",
      content: "정기런 일정, 출석/회비/추첨/운영 대시보드 기능이 업데이트되었습니다.",
      createdAt: new Date().toISOString()
    }
  ],
  guests: [],
  members: [
    {
      id: makeId(),
      name: "샘플회원",
      birthYear: 1994,
      totalRuns: 1,
      monthlyRuns: { [currentMonthKey()]: 1 },
      feeStatus: { [currentMonthKey()]: "unpaid" },
      aliases: [],
      createdAt: new Date().toISOString()
    }
  ],
  raffle: {
    lastDrawId: "",
    history: []
  },
  attendanceLogs: []
};

let db = loadDb();

const yearNode = document.getElementById("year");
const noticeList = document.getElementById("notice-list");
const guestForm = document.getElementById("guest-form");

const adminLoginButton = document.getElementById("admin-login");
const adminPasswordInput = document.getElementById("admin-password");
const adminLock = document.getElementById("admin-lock");
const adminPanel = document.getElementById("admin-panel");

const noticeForm = document.getElementById("notice-form");
const noticeTitleInput = document.getElementById("notice-title");
const noticeContentInput = document.getElementById("notice-content");

const memberForm = document.getElementById("member-form");
const memberNameInput = document.getElementById("member-name");
const memberBirthInput = document.getElementById("member-birth");

const guestList = document.getElementById("guest-list");
const memberList = document.getElementById("member-list");
const attendanceNameInput = document.getElementById("attendance-name");
const attendanceAddButton = document.getElementById("attendance-add");
const attendanceResult = document.getElementById("attendance-result");

const bulkAttendanceDateInput = document.getElementById("bulk-attendance-date");
const bulkAttendanceTypeInput = document.getElementById("bulk-attendance-type");
const bulkAttendanceInput = document.getElementById("bulk-attendance-input");
const bulkAttendanceApplyButton = document.getElementById("bulk-attendance-apply");
const bulkAttendanceResult = document.getElementById("bulk-attendance-result");
const attendanceLogList = document.getElementById("attendance-log-list");

const feeMonthSelect = document.getElementById("fee-month");
const feeList = document.getElementById("fee-list");
const feeSummary = document.getElementById("fee-summary");
const feeMarkAllUnpaidButton = document.getElementById("fee-mark-all-unpaid");
const feeOnlyUnpaidInput = document.getElementById("fee-only-unpaid");
const feeDownloadCsvButton = document.getElementById("fee-download-csv");
const feeWarningList = document.getElementById("fee-warning-list");

const riskList = document.getElementById("risk-list");

const statMembers = document.getElementById("stat-members");
const statAvgRuns = document.getElementById("stat-avg-runs");
const statEligible = document.getElementById("stat-eligible");
const statFeeRate = document.getElementById("stat-fee-rate");
const statRisk = document.getElementById("stat-risk");
const runsTrend = document.getElementById("runs-trend");
const feeTrend = document.getElementById("fee-trend");

const runRouletteButton = document.getElementById("run-roulette");
const winnerResult = document.getElementById("winner-result");
const winnerHistory = document.getElementById("winner-history");
const rouletteTrack = document.getElementById("roulette-track");
const raffleRule = document.getElementById("raffle-rule");
const nextDraw = document.getElementById("next-draw");

init();

function init() {
  yearNode.textContent = new Date().getFullYear();
  migrateLegacyData();
  populateFeeMonthOptions();
  setDefaultBulkDate();
  renderAll();
  checkScheduledDraw(false);
  initAuthGallery();

  guestForm.addEventListener("submit", handleGuestSubmit);
  adminLoginButton.addEventListener("click", handleAdminLogin);
  noticeForm.addEventListener("submit", handleNoticeAdd);
  memberForm.addEventListener("submit", handleMemberAdd);

  attendanceAddButton.addEventListener("click", handleAttendanceByName);
  attendanceNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAttendanceByName();
    }
  });

  bulkAttendanceApplyButton.addEventListener("click", handleBulkAttendanceApply);

  feeMonthSelect.addEventListener("change", () => {
    renderFees();
    renderDashboard();
    renderRisks();
  });
  feeMarkAllUnpaidButton.addEventListener("click", resetCurrentMonthFees);
  feeOnlyUnpaidInput.addEventListener("change", renderFees);
  feeDownloadCsvButton.addEventListener("click", downloadFeeCsv);

  runRouletteButton.addEventListener("click", () => checkScheduledDraw(true));

  setInterval(() => {
    renderRaffle();
    checkScheduledDraw(false);
  }, 60 * 1000);
}

function migrateLegacyData() {
  db.members = (Array.isArray(db.members) ? db.members : []).map((member) => {
    const totalRuns = Number(member.totalRuns ?? member.runs ?? 0);
    const monthlyRuns = member.monthlyRuns && typeof member.monthlyRuns === "object"
      ? member.monthlyRuns
      : { [currentMonthKey()]: totalRuns };
    const feeStatus = member.feeStatus && typeof member.feeStatus === "object"
      ? member.feeStatus
      : { [currentMonthKey()]: "unpaid" };

    return {
      id: member.id || makeId(),
      name: String(member.name || "이름없음"),
      birthYear: Number(member.birthYear || 1994),
      totalRuns,
      monthlyRuns,
      feeStatus,
      aliases: Array.isArray(member.aliases) ? member.aliases : [],
      createdAt: member.createdAt || new Date().toISOString()
    };
  });

  if (!db.raffle || typeof db.raffle !== "object") {
    db.raffle = { lastDrawId: "", history: [] };
  }
  if (!Array.isArray(db.raffle.history)) {
    db.raffle.history = [];
  }
  if (!Array.isArray(db.attendanceLogs)) {
    db.attendanceLogs = [];
  }
  if (!Array.isArray(db.notices)) {
    db.notices = [];
  }
  if (!Array.isArray(db.guests)) {
    db.guests = [];
  }

  saveDb();
}
function setDefaultBulkDate() {
  if (!bulkAttendanceDateInput) {
    return;
  }
  const now = new Date();
  bulkAttendanceDateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function handleGuestSubmit(event) {
  event.preventDefault();
  const formData = new FormData(guestForm);
  const name = String(formData.get("name") || "").trim();
  const birthYear = Number(formData.get("birthYear"));
  const phone = String(formData.get("phone") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!name || !phone) {
    alert("이름과 연락처를 입력해 주세요.");
    return;
  }
  if (birthYear < 1989 || birthYear > 2000) {
    alert("가입 가능 연령(1989~2000년생) 기준을 확인해 주세요.");
    return;
  }

  db.guests.unshift({
    id: makeId(),
    name,
    birthYear,
    phone,
    message,
    status: "대기",
    createdAt: new Date().toISOString()
  });

  saveDb();
  renderGuests();
  guestForm.reset();
  alert("게스트 신청이 저장되었습니다.");
}

function handleAdminLogin() {
  if (adminPasswordInput.value !== ADMIN_PASSWORD) {
    alert("비밀번호가 일치하지 않습니다.");
    return;
  }

  adminLock.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  renderAll();
}

function handleNoticeAdd(event) {
  event.preventDefault();
  const title = noticeTitleInput.value.trim();
  const content = noticeContentInput.value.trim();

  if (!title || !content) {
    return;
  }

  db.notices.unshift({
    id: makeId(),
    title,
    content,
    createdAt: new Date().toISOString()
  });

  saveDb();
  renderNotices();
  noticeForm.reset();
}

function handleMemberAdd(event) {
  event.preventDefault();
  const name = memberNameInput.value.trim();
  const birthYear = Number(memberBirthInput.value);

  if (!name) {
    return;
  }
  if (birthYear < 1989 || birthYear > 2000) {
    alert("회원 출생연도는 1989~2000만 가능합니다.");
    return;
  }

  db.members.unshift({
    id: makeId(),
    name,
    birthYear,
    totalRuns: 0,
    monthlyRuns: { [currentMonthKey()]: 0 },
    feeStatus: { [currentMonthKey()]: "unpaid" },
    aliases: [],
    createdAt: new Date().toISOString()
  });

  saveDb();
  renderAll();
  memberForm.reset();
}

function handleAttendanceByName() {
  const rawInput = String(attendanceNameInput.value || "").trim();
  if (!rawInput) {
    attendanceResult.textContent = "이름을 입력해 주세요.";
    return;
  }

  const names = parseNames(rawInput);
  const date = toIsoDate(new Date());
  const summary = applyAttendanceByNames(names, { date, eventType: "정기런", source: "quick" });

  attendanceNameInput.value = "";
  attendanceResult.textContent = summary.message;
}

function handleBulkAttendanceApply() {
  const raw = String(bulkAttendanceInput.value || "").trim();
  if (!raw) {
    bulkAttendanceResult.textContent = "명단을 입력해 주세요.";
    return;
  }

  const names = parseNames(raw);
  const date = bulkAttendanceDateInput.value || toIsoDate(new Date());
  const eventType = bulkAttendanceTypeInput.value || "정기런";
  const summary = applyAttendanceByNames(names, { date, eventType, source: "bulk" });

  bulkAttendanceResult.textContent = summary.message;
}

function applyAttendanceByNames(names, options) {
  const uniqueNames = dedupeNormalized(names);

  if (!uniqueNames.length) {
    return { message: "반영 가능한 이름이 없습니다." };
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  uniqueNames.forEach((name) => {
    const result = findMemberByName(name);

    if (result.type === "unique") {
      updateMemberRuns(result.member.id, 1, monthKeyFromDate(options.date));
      matched.push(result.member.name);
      return;
    }

    if (result.type === "ambiguous") {
      ambiguous.push(name);
      return;
    }

    unmatched.push(name);
  });

  db.attendanceLogs.unshift({
    id: makeId(),
    source: options.source,
    eventType: options.eventType,
    date: options.date,
    rawCount: names.length,
    matched,
    unmatched,
    ambiguous,
    createdAt: new Date().toISOString()
  });
  db.attendanceLogs = db.attendanceLogs.slice(0, 50);

  saveDb();
  renderAll();

  const parts = [];
  parts.push(`반영 ${matched.length}명`);
  if (unmatched.length) {
    parts.push(`미매칭 ${unmatched.length}명`);
  }
  if (ambiguous.length) {
    parts.push(`동명이인 ${ambiguous.length}명`);
  }

  return { message: parts.join(" | ") };
}
function findMemberByName(inputName) {
  const normalized = normalizeName(inputName);

  const exactMatches = db.members.filter((member) => {
    if (normalizeName(member.name) === normalized) {
      return true;
    }
    return (member.aliases || []).some((alias) => normalizeName(alias) === normalized);
  });

  if (exactMatches.length === 1) {
    return { type: "unique", member: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { type: "ambiguous" };
  }

  const partialMatches = db.members.filter((member) => {
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

function parseNames(raw) {
  return raw
    .split(/[\n,;/|]+/)
    .map((name) => name.trim())
    .filter(Boolean);
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

function updateMemberRuns(id, delta, monthKey = currentMonthKey()) {
  db.members = db.members.map((member) => {
    if (member.id !== id) {
      return member;
    }

    const nextTotal = Math.max(0, Number(member.totalRuns || 0) + delta);
    const currentMonthly = getMonthlyRuns(member, monthKey);
    const nextMonthly = Math.max(0, currentMonthly + delta);

    return {
      ...member,
      totalRuns: nextTotal,
      monthlyRuns: { ...(member.monthlyRuns || {}), [monthKey]: nextMonthly }
    };
  });
}

function checkScheduledDraw(forceRun) {
  const now = new Date();
  const schedule = getDrawSchedule(now);

  if (!forceRun && now < schedule.scheduledAt) {
    return;
  }
  if (!forceRun && db.raffle.lastDrawId === schedule.drawId) {
    return;
  }

  const threshold = getThresholdForMonthKey(schedule.targetMonthKey);
  const candidates = getEligibleMembers(schedule.targetMonthKey);
  const winners = pickWinners(candidates, DRAW_WINNER_COUNT);

  const record = {
    drawId: schedule.drawId,
    targetMonthKey: schedule.targetMonthKey,
    threshold,
    winnerCount: DRAW_WINNER_COUNT,
    winners: winners.map((member) => ({
      id: member.id,
      name: member.name,
      runs: getMonthlyRuns(member, schedule.targetMonthKey)
    })),
    createdAt: now.toISOString()
  };

  db.raffle.lastDrawId = schedule.drawId;
  db.raffle.history.unshift(record);
  db.raffle.history = db.raffle.history.slice(0, 12);

  db.notices.unshift({
    id: makeId(),
    title: `${monthKeyToLabel(schedule.targetMonthKey)} 참여상 추첨 결과`,
    content: winners.length > 0
      ? `${winners.map((w) => w.name).join(", ")} 축하합니다!`
      : `조건(${threshold}회 이상) 충족 회원이 없어 당첨자가 없습니다.`,
    createdAt: now.toISOString()
  });

  saveDb();
  renderAll();
  runRouletteAnimation(candidates, winners, schedule.targetMonthKey, threshold, forceRun);
}

function runRouletteAnimation(candidates, winners, monthKey, threshold, isManual) {
  if (!rouletteTrack) {
    return;
  }

  if (!candidates.length) {
    rouletteTrack.textContent = "NO CANDIDATE";
    winnerResult.textContent = `${monthKeyToLabel(monthKey)} 기준 ${threshold}회 이상 대상자가 없습니다.`;
    return;
  }

  let tick = 0;
  rouletteTrack.classList.add("spinning");
  const timer = setInterval(() => {
    rouletteTrack.textContent = candidates[tick % candidates.length].name;
    tick += 1;
  }, 95);

  setTimeout(() => {
    clearInterval(timer);
    rouletteTrack.classList.remove("spinning");

    if (!winners.length) {
      rouletteTrack.textContent = "NO WINNER";
      winnerResult.textContent = `${monthKeyToLabel(monthKey)} 당첨자가 없습니다.`;
      return;
    }

    const names = winners.map((winner) => winner.name).join(" / ");
    rouletteTrack.textContent = names;
    winnerResult.textContent = `${isManual ? "테스트" : "자동"} 추첨 완료: ${names}`;
  }, 2200);
}

function renderAll() {
  renderNotices();
  renderGuests();
  renderMembers();
  renderAttendanceLogs();
  renderFees();
  renderRisks();
  renderDashboard();
  renderRaffle();
}
function renderNotices() {
  noticeList.innerHTML = "";
  if (!db.notices.length) {
    noticeList.innerHTML = `<li class="list-item"><p class="list-meta">등록된 공지가 없습니다.</p></li>`;
    return;
  }

  db.notices.forEach((notice) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(notice.title)}</span><span class="list-meta">${formatDate(notice.createdAt)}</span></div><p>${escapeHtml(notice.content)}</p>`;

    if (!adminPanel.classList.contains("hidden")) {
      const actions = document.createElement("div");
      actions.className = "item-actions";
      actions.appendChild(buildTinyButton("삭제", () => {
        db.notices = db.notices.filter((entry) => entry.id !== notice.id);
        saveDb();
        renderNotices();
      }));
      item.appendChild(actions);
    }

    noticeList.appendChild(item);
  });
}

function renderGuests() {
  guestList.innerHTML = "";
  if (!db.guests.length) {
    guestList.innerHTML = `<li class="list-item"><p class="list-meta">게스트 신청이 없습니다.</p></li>`;
    return;
  }

  db.guests.forEach((guest) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(guest.name)} (${guest.birthYear})</span><span class="list-meta">${guest.status}</span></div><p class="list-meta">${escapeHtml(guest.phone)} | ${formatDate(guest.createdAt)}</p><p>${escapeHtml(guest.message || "-")}</p>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("승인", () => updateGuestStatus(guest.id, "승인")));
    actions.appendChild(buildTinyButton("보류", () => updateGuestStatus(guest.id, "보류")));
    actions.appendChild(buildTinyButton("삭제", () => {
      db.guests = db.guests.filter((entry) => entry.id !== guest.id);
      saveDb();
      renderGuests();
    }));

    item.appendChild(actions);
    guestList.appendChild(item);
  });
}

function updateGuestStatus(id, status) {
  db.guests = db.guests.map((guest) => (guest.id === id ? { ...guest, status } : guest));
  saveDb();
  renderGuests();
}

function renderMembers() {
  memberList.innerHTML = "";
  if (!db.members.length) {
    memberList.innerHTML = `<li class="list-item"><p class="list-meta">등록된 회원이 없습니다.</p></li>`;
    return;
  }

  const monthKey = currentMonthKey();
  const threshold = getThresholdForMonthKey(monthKey);

  db.members.forEach((member) => {
    const monthly = getMonthlyRuns(member, monthKey);
    const eligible = monthly >= threshold;
    const risk = computeMemberRisk(member, new Date());

    const riskChip = risk.level === "danger"
      ? '<span class="status-chip danger">강퇴 위험</span>'
      : risk.level === "warn"
        ? '<span class="status-chip warn">주의</span>'
        : "";

    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(member.name)} (${member.birthYear})${eligible ? '<span class="status-chip">추첨대상</span>' : ""}${riskChip}</span><span class="list-meta">이번달 ${monthly}회 / 누적 ${member.totalRuns}회</span></div>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("+1 참여", () => {
      updateMemberRuns(member.id, 1);
      saveDb();
      renderAll();
    }));
    actions.appendChild(buildTinyButton("-1 참여", () => {
      updateMemberRuns(member.id, -1);
      saveDb();
      renderAll();
    }));
    actions.appendChild(buildTinyButton("삭제", () => {
      db.members = db.members.filter((entry) => entry.id !== member.id);
      saveDb();
      renderAll();
    }));

    item.appendChild(actions);
    memberList.appendChild(item);
  });
}

function renderAttendanceLogs() {
  attendanceLogList.innerHTML = "";
  if (!db.attendanceLogs.length) {
    attendanceLogList.innerHTML = `<li class="list-item"><p class="list-meta">출석 로그가 없습니다.</p></li>`;
    return;
  }

  db.attendanceLogs.slice(0, 20).forEach((log) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${log.date} ${escapeHtml(log.eventType)}</span><span class="list-meta">반영 ${log.matched.length}명 / 미매칭 ${log.unmatched.length}명</span></div><p class="list-meta">${log.source === "bulk" ? "일괄" : "빠른"} 입력 | ${formatDate(log.createdAt)}</p><p>${log.matched.length ? `완료: ${escapeHtml(log.matched.join(", "))}` : "완료: 없음"}</p><p class="list-meta">${log.unmatched.length ? `미매칭: ${escapeHtml(log.unmatched.join(", "))}` : ""} ${log.ambiguous.length ? `동명이인: ${escapeHtml(log.ambiguous.join(", "))}` : ""}</p>`;
    attendanceLogList.appendChild(item);
  });
}

function renderFees() {
  if (!feeList || !feeSummary || !feeMonthSelect || !feeWarningList) {
    return;
  }

  const monthKey = feeMonthSelect.value || currentMonthKey();
  const onlyUnpaid = Boolean(feeOnlyUnpaidInput?.checked);
  feeList.innerHTML = "";
  feeWarningList.innerHTML = "";

  if (!db.members.length) {
    feeList.innerHTML = `<li class="list-item"><p class="list-meta">등록된 회원이 없습니다.</p></li>`;
    feeSummary.textContent = "";
    return;
  }

  let paidCount = 0;
  let unpaidCount = 0;
  const unpaidNames = [];
  let visibleCount = 0;

  db.members.forEach((member) => {
    const status = getFeeStatus(member, monthKey);
    if (status === "paid") {
      paidCount += 1;
    } else {
      unpaidCount += 1;
      unpaidNames.push(member.name);
    }

    if (onlyUnpaid && status !== "unpaid") {
      return;
    }

    visibleCount += 1;
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(member.name)}</span><span class="list-meta">${status === "paid" ? "납부" : "미납"}</span></div>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("납부", () => updateMemberFeeStatus(member.id, monthKey, "paid")));
    actions.appendChild(buildTinyButton("미납", () => updateMemberFeeStatus(member.id, monthKey, "unpaid")));
    item.appendChild(actions);
    feeList.appendChild(item);
  });

  if (visibleCount === 0) {
    feeList.innerHTML = `<li class="list-item"><p class="list-meta">표시할 회원이 없습니다.</p></li>`;
  }

  const warningMembers = getOverdueMembers(monthKey, 2);
  if (!warningMembers.length) {
    feeWarningList.innerHTML = `<li class="list-item"><p class="list-meta">경고 대상 없음</p></li>`;
  } else {
    warningMembers.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(entry.name)}</span><span class="list-meta">${entry.consecutive}개월 연속 미납</span></div>`;
      feeWarningList.appendChild(item);
    });
  }

  const totalDue = db.members.length * MONTHLY_FEE;
  const totalPaid = paidCount * MONTHLY_FEE;
  feeSummary.textContent = `${monthKeyToLabel(monthKey)} | 납부 ${paidCount}명 (${formatWon(totalPaid)}) / 미납 ${unpaidCount}명 | 총 회비 ${formatWon(totalDue)} | 미납자: ${unpaidNames.length ? unpaidNames.join(", ") : "없음"} | 경고 ${warningMembers.length}명`;
}
function updateMemberFeeStatus(id, monthKey, status) {
  db.members = db.members.map((member) => {
    if (member.id !== id) {
      return member;
    }
    return { ...member, feeStatus: { ...(member.feeStatus || {}), [monthKey]: status } };
  });

  saveDb();
  renderFees();
  renderRisks();
  renderDashboard();
}

function resetCurrentMonthFees() {
  const monthKey = feeMonthSelect.value || currentMonthKey();
  db.members = db.members.map((member) => ({
    ...member,
    feeStatus: { ...(member.feeStatus || {}), [monthKey]: "unpaid" }
  }));
  saveDb();
  renderFees();
  renderRisks();
  renderDashboard();
}

function populateFeeMonthOptions() {
  if (!feeMonthSelect) {
    return;
  }

  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    options.push(`<option value="${key}">${monthKeyToLabel(key)}</option>`);
  }
  feeMonthSelect.innerHTML = options.join("");
  feeMonthSelect.value = currentMonthKey();
}

function downloadFeeCsv() {
  const monthKey = feeMonthSelect.value || currentMonthKey();
  const rows = [["이름", "기준월", "납부상태", "연속미납개월", "누적참여횟수"]];

  db.members.forEach((member) => {
    const status = getFeeStatus(member, monthKey);
    const consecutive = getConsecutiveUnpaidMonths(member, monthKey);
    rows.push([member.name, monthKey, status === "paid" ? "납부" : "미납", String(consecutive), String(member.totalRuns || 0)]);
  });

  const csvText = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rrc-fee-${monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderRisks() {
  if (!riskList) {
    return;
  }

  const risks = db.members
    .map((member) => ({ member, risk: computeMemberRisk(member, new Date()) }))
    .filter((entry) => entry.risk.level !== "ok")
    .sort((a, b) => severityScore(b.risk.level) - severityScore(a.risk.level));

  riskList.innerHTML = "";
  if (!risks.length) {
    riskList.innerHTML = `<li class="list-item"><p class="list-meta">강퇴 위험/주의 대상이 없습니다.</p></li>`;
    return;
  }

  risks.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(entry.member.name)}</span><span class="list-meta">${entry.risk.level === "danger" ? "강퇴 위험" : "주의"}</span></div><p class="list-meta">${escapeHtml(entry.risk.reasons.join(" / "))}</p>`;
    riskList.appendChild(item);
  });
}

function computeMemberRisk(member, now) {
  const reasons = [];
  let level = "ok";
  const joinedAt = new Date(member.createdAt);
  const days = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
  const monthKey = currentMonthKey(now);
  const monthRuns = getMonthlyRuns(member, monthKey);
  const dayOfMonth = now.getDate();
  const feeStatus = getFeeStatus(member, monthKey);

  if (days <= 14 && monthRuns < 1) {
    level = "danger";
    reasons.push("신규 2주 내 1회 미참여");
  }
  if (days > 14 && days <= 21 && monthRuns < 2) {
    level = "danger";
    reasons.push("신규 3주 내 2회 미참여");
  }
  if (days > 21) {
    if (dayOfMonth >= 28 && monthRuns < 2) {
      level = "danger";
      reasons.push("월 2회 미참여(기존회원)");
    } else if (dayOfMonth >= 15 && monthRuns < 1 && level !== "danger") {
      level = "warn";
      reasons.push("월 중순 기준 참여 부족");
    }
  }
  if (dayOfMonth > 7 && feeStatus !== "paid") {
    if (level !== "danger") {
      level = "warn";
    }
    reasons.push("회비 납부기한 경과(1~7일)");
  }

  const overdue = getConsecutiveUnpaidMonths(member, monthKey);
  if (overdue >= 2) {
    if (level !== "danger") {
      level = "warn";
    }
    reasons.push(`${overdue}개월 연속 회비 미납`);
  }

  return { level, reasons: reasons.length ? reasons : ["정상"] };
}

function renderDashboard() {
  const monthKey = feeMonthSelect.value || currentMonthKey();
  const memberCount = db.members.length;
  const monthRunsTotal = db.members.reduce((sum, member) => sum + getMonthlyRuns(member, monthKey), 0);
  const avgRuns = memberCount ? monthRunsTotal / memberCount : 0;
  const eligibleCount = getEligibleMembers(monthKey).length;
  const paidCount = db.members.filter((member) => getFeeStatus(member, monthKey) === "paid").length;
  const feeRate = memberCount ? (paidCount / memberCount) * 100 : 0;
  const riskCount = db.members.filter((member) => computeMemberRisk(member, new Date()).level !== "ok").length;

  statMembers.textContent = `${memberCount}명`;
  statAvgRuns.textContent = avgRuns.toFixed(1);
  statEligible.textContent = `${eligibleCount}명`;
  statFeeRate.textContent = `${feeRate.toFixed(0)}%`;
  statRisk.textContent = `${riskCount}명`;

  const keys = getRecentMonthKeys(6);
  const runSeries = keys.map((key) => ({ key, value: db.members.reduce((sum, member) => sum + getMonthlyRuns(member, key), 0) }));
  const feeSeries = keys.map((key) => {
    const paid = db.members.filter((member) => getFeeStatus(member, key) === "paid").length;
    return { key, value: memberCount ? (paid / memberCount) * 100 : 0 };
  });

  renderTrend(runsTrend, runSeries, "회");
  renderTrend(feeTrend, feeSeries, "%");
}

function renderTrend(target, series, suffix) {
  if (!target) {
    return;
  }

  const max = Math.max(1, ...series.map((entry) => entry.value));
  target.innerHTML = "";

  series.forEach((entry) => {
    const width = Math.max(2, (entry.value / max) * 100);
    const li = document.createElement("li");
    li.className = "trend-item";
    li.innerHTML = `<span>${entry.key.slice(2)}</span><span class="trend-bar-wrap"><span class="trend-bar" style="width:${width}%"></span></span><span>${Number(entry.value).toFixed(suffix === "%" ? 0 : 1)}${suffix}</span>`;
    target.appendChild(li);
  });
}

function renderRaffle() {
  const now = new Date();
  const currentKey = currentMonthKey(now);
  const currentThreshold = getThresholdForMonthKey(currentKey);
  const currentEligibleCount = getEligibleMembers(currentKey).length;
  const schedule = getDrawSchedule(now);

  raffleRule.textContent = `${monthKeyToLabel(currentKey)} 기준: ${currentThreshold}회 이상 참여 시 자동 추첨 대상 (${currentEligibleCount}명 대상)`;
  nextDraw.textContent = `다음 자동 추첨: ${formatDateTime(getNextDrawAt(now))} (매월 1일 12:00)`;

  winnerHistory.innerHTML = "";
  if (!db.raffle.history.length) {
    winnerHistory.innerHTML = `<li class="list-item"><p class="list-meta">추첨 기록이 없습니다.</p></li>`;
  } else {
    db.raffle.history.forEach((record) => {
      const names = record.winners.length ? record.winners.map((winner) => winner.name).join(", ") : "당첨자 없음";
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `<div class="list-top"><span class="list-title">${monthKeyToLabel(record.targetMonthKey)} 추첨</span><span class="list-meta">${formatDate(record.createdAt)}</span></div><p class="list-meta">기준 ${record.threshold}회 / ${record.winnerCount}명 추첨</p><p>${escapeHtml(names)}</p>`;
      winnerHistory.appendChild(item);
    });
  }

  if (db.raffle.lastDrawId === schedule.drawId) {
    winnerResult.textContent = `${monthKeyToLabel(schedule.targetMonthKey)} 자동 추첨 완료 상태입니다.`;
  }
}
function getEligibleMembers(monthKey) {
  const threshold = getThresholdForMonthKey(monthKey);
  return db.members.filter((member) => getMonthlyRuns(member, monthKey) >= threshold);
}

function getDrawSchedule(now) {
  return {
    drawId: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    targetMonthKey: previousMonthKey(now),
    scheduledAt: new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0)
  };
}

function getNextDrawAt(now) {
  const thisMonthDrawAt = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  if (now < thisMonthDrawAt) {
    return thisMonthDrawAt;
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0, 0);
}

function getThresholdForMonthKey(monthKey) {
  const month = Number(monthKey.split("-")[1]);
  return WINTER_MONTHS.includes(month) ? 4 : 5;
}

function getMonthlyRuns(member, monthKey) {
  const monthlyRuns = member.monthlyRuns || {};
  return Number(monthlyRuns[monthKey] || 0);
}

function getFeeStatus(member, monthKey) {
  return member.feeStatus && member.feeStatus[monthKey] === "paid" ? "paid" : "unpaid";
}

function getOverdueMembers(monthKey, minConsecutive) {
  return db.members
    .map((member) => ({ id: member.id, name: member.name, consecutive: getConsecutiveUnpaidMonths(member, monthKey) }))
    .filter((entry) => entry.consecutive >= minConsecutive)
    .sort((a, b) => b.consecutive - a.consecutive);
}

function getConsecutiveUnpaidMonths(member, monthKey) {
  let count = 0;
  for (let i = 0; i < 12; i += 1) {
    const key = shiftMonthKey(monthKey, -i);
    if (getFeeStatus(member, key) !== "unpaid") {
      break;
    }
    count += 1;
  }
  return count;
}

function pickWinners(candidates, count) {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function getRecentMonthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }
  return keys;
}

function monthKeyFromDate(dateText) {
  const dt = new Date(dateText);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

function shiftMonthKey(monthKey, diff) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function previousMonthKey(date = new Date()) {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${pad(previous.getMonth() + 1)}`;
}

function monthKeyToLabel(key) {
  const [year, month] = key.split("-");
  return `${year}년 ${month}월`;
}

function severityScore(level) {
  if (level === "danger") {
    return 2;
  }
  if (level === "warn") {
    return 1;
  }
  return 0;
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function formatWon(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(defaultData);
    }

    const parsed = JSON.parse(raw);
    return {
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
      guests: Array.isArray(parsed.guests) ? parsed.guests : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      raffle: parsed.raffle || { lastDrawId: "", history: [] },
      attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : []
    };
  } catch (error) {
    console.error("DB load failed", error);
    return structuredClone(defaultData);
  }
}

function saveDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDateTime(date) {
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTinyButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn tiny ghost";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


let supabaseClient = null;
let authUser = null;

const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authSignupButton = document.getElementById("auth-signup");
const authLoginButton = document.getElementById("auth-login");
const authLogoutButton = document.getElementById("auth-logout");
const authStatus = document.getElementById("auth-status");

const photoFileInput = document.getElementById("photo-file");
const photoCaptionInput = document.getElementById("photo-caption");
const photoUploadButton = document.getElementById("photo-upload");
const photoStatus = document.getElementById("photo-status");
const photoGrid = document.getElementById("photo-grid");

function initAuthGallery() {
  if (!authStatus || !photoGrid) {
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    authStatus.textContent = "사진첩 비활성화: SUPABASE 설정값이 필요합니다.";
    photoStatus.textContent = "README의 Supabase 설정 후 사용 가능합니다.";
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    authStatus.textContent = "사진첩 비활성화: Supabase 라이브러리를 불러오지 못했습니다.";
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  authSignupButton.addEventListener("click", handleSignup);
  authLoginButton.addEventListener("click", handleLogin);
  authLogoutButton.addEventListener("click", handleLogout);
  photoUploadButton.addEventListener("click", handlePhotoUpload);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    authUser = session?.user || null;
    renderAuthState();
    loadPhotos();
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    authUser = data?.session?.user || null;
    renderAuthState();
    loadPhotos();
  });
}

async function handleSignup() {
  const email = String(authEmailInput.value || "").trim();
  const password = String(authPasswordInput.value || "").trim();

  if (!email || !password) {
    authStatus.textContent = "이메일/비밀번호를 입력하세요.";
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    authStatus.textContent = `회원가입 실패: ${error.message}`;
    return;
  }

  authStatus.textContent = "회원가입 완료. 이메일 인증이 설정된 경우 메일을 확인하세요.";
}

async function handleLogin() {
  const email = String(authEmailInput.value || "").trim();
  const password = String(authPasswordInput.value || "").trim();

  if (!email || !password) {
    authStatus.textContent = "이메일/비밀번호를 입력하세요.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    authStatus.textContent = `로그인 실패: ${error.message}`;
    return;
  }

  authStatus.textContent = "로그인 성공";
}

async function handleLogout() {
  if (!supabaseClient) {
    return;
  }
  await supabaseClient.auth.signOut();
  authStatus.textContent = "로그아웃 완료";
}

function renderAuthState() {
  if (!authUser) {
    authStatus.textContent = "로그인 필요";
    photoStatus.textContent = "로그인 후 업로드 가능합니다.";
    return;
  }

  authStatus.textContent = `로그인됨: ${authUser.email}`;
  photoStatus.textContent = "사진 업로드 가능";
}

async function handlePhotoUpload() {
  if (!authUser) {
    photoStatus.textContent = "로그인 후 업로드하세요.";
    return;
  }

  const file = photoFileInput.files?.[0];
  if (!file) {
    photoStatus.textContent = "업로드할 사진 파일을 선택하세요.";
    return;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${authUser.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  photoStatus.textContent = "업로드 중...";

  const uploadResult = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type
  });

  if (uploadResult.error) {
    photoStatus.textContent = `업로드 실패: ${uploadResult.error.message}`;
    return;
  }

  const caption = String(photoCaptionInput.value || "").trim();

  const insertResult = await supabaseClient.from("photos").insert({
    user_id: authUser.id,
    file_path: path,
    caption
  });

  if (insertResult.error) {
    photoStatus.textContent = `메타 저장 실패: ${insertResult.error.message}`;
    return;
  }

  photoFileInput.value = "";
  photoCaptionInput.value = "";
  photoStatus.textContent = "업로드 완료";
  await loadPhotos();
}

async function loadPhotos() {
  if (!supabaseClient || !photoGrid) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("photos")
    .select("id,user_id,file_path,caption,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    photoStatus.textContent = `사진 목록 로드 실패: ${error.message}`;
    return;
  }

  photoGrid.innerHTML = "";
  if (!data || !data.length) {
    photoGrid.innerHTML = '<p class="list-meta">아직 업로드된 사진이 없습니다.</p>';
    return;
  }

  data.forEach((photo) => {
    const { data: urlData } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(photo.file_path);
    const card = document.createElement("article");
    card.className = "photo-item";

    const safeCaption = escapeHtml(photo.caption || "");
    const safeDate = formatDate(photo.created_at);

    card.innerHTML = `
      <img src="${urlData.publicUrl}" alt="RRC photo" loading="lazy" />
      <div class="photo-meta">
        <div>${safeCaption || "무설명"}</div>
        <div>${safeDate}</div>
      </div>
    `;

    photoGrid.appendChild(card);
  });
}





