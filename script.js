
const STORAGE_KEY = "rrc-site-db-v3";
const ADMIN_SNAPSHOT_META_KEY = "rrc-admin-snapshot-meta-v1";
const SHARED_AUTH_STORAGE_KEY = "rrc-auth";

const WINTER_MONTHS = [12, 1, 2];
const DRAW_WINNER_COUNT = 4;
const MONTHLY_FEE = 5000;
const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PHOTO_BUCKET = "rrc-photos";

const defaultData = {
  notices: [
    {
      id: makeId(),
      title: "RRC 홈페이지 안내",
      content: "정기런 공지, 출석, 회비, 추첨, 운영 기능이 포함된 최신 버전입니다.",
      createdAt: new Date().toISOString()
    }
  ],
  guests: [],
  members: [],
  raffle: {
    lastDrawId: "",
    history: []
  },
  attendanceLogs: [],
  auditLogs: []
};

let db = loadDb();

const yearNode = document.getElementById("year");
const noticeList = document.getElementById("notice-list");
const guestForm = document.getElementById("guest-form");

const adminLoginButton = document.getElementById("admin-login");
const adminEmailInput = document.getElementById("admin-email");
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
const memberSearchInput = document.getElementById("member-search");
const memberFilterSelect = document.getElementById("member-filter");
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
const approvalRefreshButton = document.getElementById("approval-refresh");
const approvalList = document.getElementById("approval-list");
const syncSupabaseButton = document.getElementById("sync-supabase");
const recoverMembersButton = document.getElementById("recover-members");
const syncStatus = document.getElementById("sync-status");
const syncMeta = document.getElementById("sync-meta");
const roleRefreshButton = document.getElementById("role-refresh");
const roleList = document.getElementById("role-list");
const roleStatus = document.getElementById("role-status");
const publicRaffleRule = document.getElementById("public-raffle-rule");
const publicNextDraw = document.getElementById("public-next-draw");
const publicWinnerHistory = document.getElementById("public-winner-history");
const publicRaffleSpotlight = document.getElementById("public-raffle-spotlight");
const publicRaffleCandidates = document.getElementById("public-raffle-candidates");
const raffleCandidates = document.getElementById("raffle-candidates");
const auditLogList = document.getElementById("audit-log-list");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");

let adminAuthClient = null;
let currentAdminToken = "";
let currentAdminUserId = "";

let currentAdminCanManageRoles = false;
let publicDataClient = null;
let publicRaffleHistory = [];
let publicNoticeItems = [];
let memberProfileSummaryByKey = new Map();
let memberFilterMetaNode = null;
let restoreBackupButton = null;
let autoSyncTimer = null;
let autoSyncPending = false;

init();

function init() {
  yearNode.textContent = new Date().getFullYear();
  markCurrentNavigation();
  migrateLegacyData();
  configureAdminInputs();
  configureSyncActions();
  populateFeeMonthOptions();
  setDefaultBulkDate();
  renderAll();
  checkScheduledDraw(false);
  loadPublicRaffleData();
  attachAdminSessionListeners();
  void restoreAdminSession();

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

  runRouletteButton.addEventListener("click", runManualRafflePreview);

  if (approvalRefreshButton) {
    approvalRefreshButton.addEventListener("click", loadApprovalQueue);
  }
  if (syncSupabaseButton) {
    syncSupabaseButton.addEventListener("click", syncDataToSupabase);
  }
  if (recoverMembersButton) {
    recoverMembersButton.addEventListener("click", recoverMembersFromProfiles);
  }
  if (roleRefreshButton) {
    roleRefreshButton.addEventListener("click", loadRoleList);
  }
  memberSearchInput?.addEventListener("input", renderMembers);
  memberFilterSelect?.addEventListener("change", renderMembers);
  window.addEventListener("hashchange", markCurrentNavigation);

  setInterval(() => {
    renderRaffle();
    checkScheduledDraw(false);
  }, 60 * 1000);

  setInterval(() => {
    loadPublicRaffleData();
  }, 10 * 60 * 1000);
}

function attachAdminSessionListeners() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return;
  }

  try {
    const client = getAdminAuthClient();
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session?.access_token) {
        void restoreAdminSession();
        return;
      }
      resetAdminSessionState();
    });
  } catch (_error) {
    // Ignore auth listener failures.
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    void restoreAdminSession();
  });
}

function markCurrentNavigation() {
  const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const currentHash = String(window.location.hash || "").toLowerCase();
  document.querySelectorAll(".nav-links a[href]").forEach((link) => {
    const rawHref = String(link.getAttribute("href") || "");
    if (!rawHref || rawHref.startsWith("http")) {
      return;
    }

    const [hrefPath, hrefHash = ""] = rawHref.toLowerCase().split("#");
    const normalizedPath = hrefPath || currentPath;
    const normalizedHash = hrefHash ? `#${hrefHash}` : "";
    const isCurrent = normalizedPath === currentPath && (!normalizedHash || normalizedHash === currentHash);
    link.classList.toggle("is-current", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function configureAdminInputs() {
  const koreanTextInputs = [memberNameInput, attendanceNameInput, memberSearchInput, bulkAttendanceInput];
  koreanTextInputs.forEach((node) => {
    if (!node) {
      return;
    }
    node.setAttribute("lang", "ko");
    node.setAttribute("inputmode", "text");
    node.setAttribute("autocapitalize", "off");
    node.setAttribute("autocomplete", "off");
  });

  if (memberSearchInput) {
    memberSearchInput.placeholder = "이름 검색";
  }

  if (!memberFilterMetaNode && memberFilterSelect?.parentElement) {
    memberFilterMetaNode = document.createElement("p");
    memberFilterMetaNode.className = "list-meta";
    memberFilterMetaNode.style.margin = "0.45rem 0 0";
    memberFilterSelect.parentElement.insertAdjacentElement("afterend", memberFilterMetaNode);
  }

  if (memberFilterSelect && !memberFilterSelect.querySelector('option[value="active"]')) {
    memberFilterSelect.insertAdjacentHTML("afterbegin", [
      '<option value="all">전체</option>',
      '<option value="active">활성 회원</option>',
      '<option value="inactive">휴면 회원</option>'
    ].join(""));
    const duplicateAllOption = memberFilterSelect.querySelectorAll('option[value="all"]');
    duplicateAllOption.forEach((option, index) => {
      if (index > 0) {
        option.remove();
      }
    });
  }
}

function configureSyncActions() {
  if (!recoverMembersButton || restoreBackupButton) {
    return;
  }

  restoreBackupButton = document.createElement("button");
  restoreBackupButton.id = "restore-sync-backup";
  restoreBackupButton.type = "button";
  restoreBackupButton.className = "btn ghost";
  restoreBackupButton.textContent = "마지막 백업 복원";
  recoverMembersButton.insertAdjacentElement("afterend", restoreBackupButton);
  restoreBackupButton.addEventListener("click", restoreLastSyncBackup);
}

function setAdminPanelVisibility(isVisible) {
  adminNavLinks.forEach((node) => setNodeVisibility(node, isVisible));
  if (adminLock) {
    adminLock.classList.toggle("hidden", isVisible);
  }
  if (adminPanel) {
    adminPanel.classList.toggle("hidden", !isVisible);
  }
}

function resetAdminSessionState() {
  currentAdminToken = "";
  currentAdminUserId = "";
  currentAdminCanManageRoles = false;
  setAdminPanelVisibility(false);
}

async function loadAdminAccessProfile(client, userId) {
  const profileResult = await client
    .from("member_profiles")
    .select("role,approval_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileResult.error) {
    throw profileResult.error;
  }

  return profileResult.data || null;
}

async function openAdminSession({ client, user, accessToken, profile }) {
  currentAdminToken = accessToken;
  currentAdminCanManageRoles = Boolean(user?.email && String(user.email).toLowerCase() === "chlgusgn11@gmail.com");
  currentAdminUserId = user.id;
  setAdminPanelVisibility(true);
  if (syncStatus) {
    syncStatus.textContent = "동기화 준비 완료";
  }
  if (roleStatus) {
    roleStatus.textContent = buildAdminRoleStatusText(profile?.role, profile?.approval_status, currentAdminCanManageRoles);
  }

  await loadAdminSnapshot();
  loadSyncMetadata();
  loadApprovalQueue();
  loadRoleList();
  renderAll();
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
      isActive: member.isActive !== false && member.is_active !== false,
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
function getAdminAuthClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 설정이 필요합니다.");
  }
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase 라이브러리를 불러오지 못했습니다.");
  }
  if (!adminAuthClient) {
    adminAuthClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SHARED_AUTH_STORAGE_KEY
      }
    });
  }
  return adminAuthClient;
}

function getPublicDataClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  if (!window.supabase || !window.supabase.createClient) {
    return null;
  }
  if (!publicDataClient) {
    publicDataClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SHARED_AUTH_STORAGE_KEY
      }
    });
  }
  return publicDataClient;
}

async function loadMembersSnapshot(client) {
  const withFeeStatus = await client
    .from("members")
    .select("id,name,birth_year,total_runs,monthly_runs,fee_status,aliases,is_active,created_at")
    .order("created_at", { ascending: false });

  if (!withFeeStatus.error) {
    return withFeeStatus;
  }

  if (!isMissingColumnError(withFeeStatus.error, "fee_status")) {
    return withFeeStatus;
  }

  const legacyResult = await client
    .from("members")
    .select("id,name,birth_year,total_runs,monthly_runs,aliases,is_active,created_at")
    .order("created_at", { ascending: false });

  if (legacyResult.error) {
    return legacyResult;
  }

  return {
    data: (Array.isArray(legacyResult.data) ? legacyResult.data : []).map((member) => ({
      ...member,
      fee_status: {}
    })),
    error: null
  };
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(String(columnName || "").toLowerCase()) && message.includes("does not exist");
}

async function loadPublicRaffleData() {
  if (!publicWinnerHistory && !publicRaffleRule && !publicNextDraw) {
    return;
  }

  const client = getPublicDataClient();
  if (!client) {
    return;
  }

  const historyResult = await client
    .from("raffle_history")
    .select("target_month_key,threshold,winner_count,winners,created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (historyResult.error) {
    return;
  }

  publicRaffleHistory = (Array.isArray(historyResult.data) ? historyResult.data : []).map((record) => ({
    targetMonthKey: record.target_month_key,
    threshold: Number(record.threshold || 0),
    winnerCount: Number(record.winner_count || 0),
    winners: Array.isArray(record.winners) ? record.winners : [],
    createdAt: record.created_at || new Date().toISOString()
  }));

  renderRaffle();
}

async function loadPublicNoticeData() {
  if (!noticeList) {
    return;
  }

  const client = getPublicDataClient();
  if (!client) {
    return;
  }

  const noticeResult = await client
    .from("notices")
    .select("id,title,content,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (noticeResult.error) {
    return;
  }

  publicNoticeItems = (Array.isArray(noticeResult.data) ? noticeResult.data : []).map((notice) => ({
    id: notice.id || makeId(),
    title: String(notice.title || "\uACF5\uC9C0"),
    content: String(notice.content || ""),
    createdAt: notice.created_at || new Date().toISOString()
  }));

  if (adminPanel?.classList.contains("hidden")) {
    renderNotices();
  }
}

async function loadSyncMetadata() {
  if (!syncMeta || !currentAdminToken) {
    return;
  }

  try {
    const client = getAdminAuthClient();
    const result = await client
      .from("settings")
      .select("value,updated_at")
      .eq("key", "last_sync_meta")
      .maybeSingle();

    if (result.error || !result.data) {
      syncMeta.textContent = "마지막 동기화: 기록 없음";
      await refreshSyncOverview();
      return;
    }

    const syncedAt = result.data?.value?.synced_at || result.data.updated_at;
    syncMeta.textContent = syncedAt ? `마지막 동기화: ${formatDateTime(new Date(syncedAt))}` : "마지막 동기화: 기록 없음";
    await refreshSyncOverview();
  } catch (_error) {
    syncMeta.textContent = "마지막 동기화: 기록 없음";
    await refreshSyncOverview();
  }
}


async function loadAdminSnapshot() {
  if (!currentAdminToken) {
    return;
  }

  const client = getAdminAuthClient();
  const [membersResult, guestsResult, noticesResult, attendanceResult, raffleResult, auditResult, profilesResult] = await Promise.all([
    loadMembersSnapshot(client),
    client.from("guests").select("id,name,birth_year,phone,message,status,created_at").order("created_at", { ascending: false }),
    client.from("notices").select("id,title,content,created_at").order("created_at", { ascending: false }),
    client.from("attendance_logs").select("id,source,event_type,attendance_date,raw_count,matched,unmatched,ambiguous,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("raffle_history").select("draw_id,target_month_key,threshold,winner_count,winners,created_at").order("created_at", { ascending: false }).limit(12),
    client.from("operation_logs").select("id,actor_name,action,detail,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("member_profiles").select("user_id,email,name,birth_year,approval_status,role").limit(500)
  ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  const remoteSnapshot = {
    notices: Array.isArray(noticesResult.data) ? noticesResult.data.map((notice) => ({
      id: notice.id || makeId(),
      title: String(notice.title || "??"),
      content: String(notice.content || ""),
      createdAt: notice.created_at || new Date().toISOString()
    })) : [],
    guests: Array.isArray(guestsResult.data) ? guestsResult.data.map((guest) => ({
      id: guest.id || makeId(),
      name: String(guest.name || "???"),
      birthYear: Number(guest.birth_year || 1994),
      phone: String(guest.phone || ""),
      message: String(guest.message || ""),
      status: String(guest.status || "??"),
      createdAt: guest.created_at || new Date().toISOString()
    })) : [],
    members: Array.isArray(membersResult.data) ? membersResult.data.map((member) => ({
      id: member.id || makeId(),
      name: String(member.name || "이름없음"),
      birthYear: Number(member.birth_year || 1994),
      totalRuns: Number(member.total_runs || 0),
      monthlyRuns: member.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {},
      feeStatus: member.fee_status && typeof member.fee_status === "object" ? member.fee_status : {},
      isActive: member.is_active !== false,
      aliases: Array.isArray(member.aliases) ? member.aliases : [],
      createdAt: member.created_at || new Date().toISOString()
    })) : [],
    raffle: {
      lastDrawId: Array.isArray(raffleResult.data) && raffleResult.data[0] ? String(raffleResult.data[0].draw_id || "") : "",
      history: Array.isArray(raffleResult.data) ? raffleResult.data.map((record) => ({
        drawId: record.draw_id || "",
        targetMonthKey: record.target_month_key,
        threshold: Number(record.threshold || 0),
        winnerCount: Number(record.winner_count || 0),
        winners: Array.isArray(record.winners) ? record.winners : [],
        createdAt: record.created_at || new Date().toISOString()
      })) : []
    },
    attendanceLogs: Array.isArray(attendanceResult.data) ? attendanceResult.data.map((log) => ({
      id: log.id || makeId(),
      source: String(log.source || "bulk"),
      eventType: String(log.event_type || "???"),
      date: String(log.attendance_date || toIsoDate(new Date())),
      rawCount: Number(log.raw_count || 0),
      matched: Array.isArray(log.matched) ? log.matched : [],
      unmatched: Array.isArray(log.unmatched) ? log.unmatched : [],
      ambiguous: Array.isArray(log.ambiguous) ? log.ambiguous : [],
      createdAt: log.created_at || new Date().toISOString()
    })) : [],
    auditLogs: Array.isArray(auditResult.data) ? auditResult.data.map((entry) => ({
      id: entry.id || makeId(),
      actorName: String(entry.actor_name || "???"),
      action: String(entry.action || "??"),
      detail: String(entry.detail || ""),
      createdAt: entry.created_at || new Date().toISOString()
    })) : []
  };

  const localMembers = Array.isArray(db.members) ? db.members : [];
  const preserveLocalMembers = shouldPreserveLocalMembers(localMembers, remoteSnapshot.members);
  const preservedMembers = preserveLocalMembers
    ? mergeMemberCollections(localMembers, remoteSnapshot.members)
    : remoteSnapshot.members;

  db = {
    ...remoteSnapshot,
    members: preservedMembers
  };

  hydrateMemberProfileSummary(profilesResult.error ? [] : profilesResult.data);

  migrateLegacyData();
  saveDb();

  if (syncStatus) {
    if (preserveLocalMembers) {
      const localOnlyCount = Math.max(0, preservedMembers.length - remoteSnapshot.members.length);
      syncStatus.textContent = `Supabase 회원 목록이 비어 있거나 오래된 상태라 로컬 회원 ${localOnlyCount || preservedMembers.length}명을 유지했습니다. 필요하면 지금 동기화를 눌러 주세요.`;
    } else {
      syncStatus.textContent = "동기화 준비 완료";
    }
  }
}

function formatApprovalStatusLabel(status) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "pending") return "승인 대기";
  return "미확인";
}

function formatRoleLabel(role, isOwner = false) {
  if (role === "admin") {
    return isOwner ? "운영진(오너)" : "운영진";
  }
  return "일반회원";
}

function buildAdminRoleStatusText(role, approvalStatus, canManageRoles) {
  const roleLabel = formatRoleLabel(role, Boolean(canManageRoles));
  const approvalLabel = formatApprovalStatusLabel(approvalStatus);
  const manageLabel = canManageRoles ? "가능" : "불가";
  return "내 권한: " + roleLabel + " / 승인: " + approvalLabel + " / 권한 변경 가능: " + manageLabel;
}

function hydrateMemberProfileSummary(items) {
  memberProfileSummaryByKey = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = buildMemberIdentityKey(item?.name, item?.birth_year);
    if (!key) {
      return;
    }
    memberProfileSummaryByKey.set(key, {
      userId: item?.user_id || "",
      email: String(item?.email || ""),
      approvalStatus: String(item?.approval_status || "pending"),
      role: String(item?.role || "member")
    });
  });
}

function buildMemberIdentityKey(name, birthYear) {
  const normalizedName = normalizeName(name);
  const normalizedBirthYear = Number(birthYear || 0);
  if (!normalizedName) {
    return "";
  }
  return `${normalizedName}|${normalizedBirthYear}`;
}

function getMemberAccountSummary(member) {
  const key = buildMemberIdentityKey(member?.name, member?.birthYear);
  return key ? (memberProfileSummaryByKey.get(key) || null) : null;
}

function buildMemberAccountChips(member) {
  const summary = getMemberAccountSummary(member);
  if (!summary) {
    return '<span class="status-chip">미가입</span>';
  }

  const chips = ['<span class="status-chip">가입</span>'];
  if (summary.approvalStatus === "pending") {
    chips.push('<span class="status-chip warn">승인 대기</span>');
  } else if (summary.approvalStatus === "rejected") {
    chips.push('<span class="status-chip danger">반려</span>');
  }
  if (summary.role === "admin") {
    chips.push('<span class="status-chip">운영진</span>');
  }
  return chips.join("");
}

function buildMemberAccountMeta(member) {
  const summary = getMemberAccountSummary(member);
  if (!summary) {
    return "웹 계정 연결 없음";
  }

  const statusText = formatApprovalStatusLabel(summary.approvalStatus);
  const roleText = formatRoleLabel(summary.role);
  return `${summary.email || "이메일 없음"} · ${statusText} · ${roleText}`;
}

function confirmMemberDeletion(member) {
  const summary = getMemberAccountSummary(member);
  const warning = summary
    ? "이 회원은 웹 가입 계정 정보와 연결되어 있을 수 있습니다. 운영 회원 목록에서만 삭제할지 꼭 확인해 주세요."
    : "이 회원의 출석/회비/추첨 기준 데이터가 운영 목록에서 삭제됩니다.";
  return confirm(`${member.name} (${member.birthYear}) 회원을 삭제할까요?\n\n${warning}`);
}

function confirmMemberToggleActive(member, nextActive) {
  const actionLabel = nextActive ? "활성화" : "휴면 전환";
  const effectText = nextActive
    ? "다시 활성 회원 목록과 추첨/위험 관리에 포함됩니다."
    : "휴면 회원으로 전환되어 기본 회원 목록, 추첨, 위험 관리에서 제외됩니다.";
  return confirm(`${member.name} (${member.birthYear}) 회원을 ${actionLabel}할까요?\n\n${effectText}`);
}

function shouldPreserveLocalMembers(localMembers, remoteMembers) {
  const localMeaningfulCount = countMeaningfulMembers(localMembers);
  if (localMeaningfulCount === 0) {
    return false;
  }

  const remoteMeaningfulCount = countMeaningfulMembers(remoteMembers);
  if (remoteMeaningfulCount === 0) {
    return true;
  }

  return localMeaningfulCount > remoteMeaningfulCount;
}

function countMeaningfulMembers(members) {
  if (!Array.isArray(members)) {
    return 0;
  }
  return members.filter((member) => !isPlaceholderMember(member)).length;
}

function isPlaceholderMember(member) {
  const name = String(member?.name || "").trim();
  return name === "샘플회원";
}

function mergeMemberCollections(localMembers, remoteMembers) {
  const merged = new Map();

  remoteMembers.forEach((member) => {
    const normalized = normalizeMemberRecord(member);
    merged.set(memberMergeKey(normalized), normalized);
  });

  localMembers.forEach((member) => {
    const normalized = normalizeMemberRecord(member);
    const key = memberMergeKey(normalized);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeMemberRecord(existing, normalized) : normalized);
  });

  return Array.from(merged.values()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}

function normalizeMemberRecord(member) {
  return {
    id: member?.id || makeId(),
    name: String(member?.name || "이름없음"),
    birthYear: Number(member?.birthYear || member?.birth_year || 1994),
    totalRuns: Number(member?.totalRuns || member?.total_runs || 0),
    monthlyRuns: member?.monthlyRuns && typeof member.monthlyRuns === "object"
      ? member.monthlyRuns
      : member?.monthly_runs && typeof member.monthly_runs === "object"
        ? member.monthly_runs
        : {},
    feeStatus: member?.feeStatus && typeof member.feeStatus === "object"
      ? member.feeStatus
      : member?.fee_status && typeof member.fee_status === "object"
        ? member.fee_status
        : {},
    isActive: member?.isActive !== false && member?.is_active !== false,
    aliases: Array.isArray(member?.aliases) ? member.aliases : [],
    createdAt: member?.createdAt || member?.created_at || new Date().toISOString()
  };
}

function memberMergeKey(member) {
  const normalizedName = normalizeName(member?.name || "");
  const birthYear = Number(member?.birthYear || 0);
  return `${normalizedName}|${birthYear}`;
}

function mergeMemberRecord(primary, secondary) {
  const mergedMonthlyRuns = { ...(primary.monthlyRuns || {}) };
  Object.entries(secondary.monthlyRuns || {}).forEach(([monthKey, runs]) => {
    mergedMonthlyRuns[monthKey] = Math.max(Number(mergedMonthlyRuns[monthKey] || 0), Number(runs || 0));
  });

  const mergedFeeStatus = { ...(primary.feeStatus || {}) };
  Object.entries(secondary.feeStatus || {}).forEach(([monthKey, status]) => {
    if (!mergedFeeStatus[monthKey] || mergedFeeStatus[monthKey] !== "paid") {
      mergedFeeStatus[monthKey] = status;
    }
  });

  const aliases = Array.from(new Set([...(primary.aliases || []), ...(secondary.aliases || [])].filter(Boolean)));

  return {
    id: primary.id || secondary.id || makeId(),
    name: primary.name || secondary.name || "이름없음",
    birthYear: Number(primary.birthYear || secondary.birthYear || 1994),
    totalRuns: Math.max(Number(primary.totalRuns || 0), Number(secondary.totalRuns || 0)),
    monthlyRuns: mergedMonthlyRuns,
    feeStatus: mergedFeeStatus,
    isActive: primary.isActive !== false && secondary.isActive !== false,
    aliases,
    createdAt: primary.createdAt || secondary.createdAt || new Date().toISOString()
  };
}

function setNodeVisibility(node, visible) {
  if (!node) {
    return;
  }
  node.classList.toggle("hidden", !visible);
  node.hidden = !visible;
}

function getSelectedAttendanceDate() {
  return bulkAttendanceDateInput?.value || toIsoDate(new Date());
}

function setDefaultBulkDate() {
  if (!bulkAttendanceDateInput) {
    return;
  }
  const now = new Date();
  bulkAttendanceDateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function handleGuestSubmit(event) {
  event.preventDefault();
  const formData = new FormData(guestForm);
  const name = String(formData.get("name") || "").trim();
  const birthYear = Number(formData.get("birthYear"));
  const phone = String(formData.get("phone") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!name || !phone) {
    alert("이름과 연락처는 필수입니다.");
    return;
  }
  if (birthYear < 1989 || birthYear > 2000) {
    alert("출생연도는 1989~2000만 가능합니다.");
    return;
  }

  const client = getPublicDataClient();
  if (client) {
    const insertResult = await client.from("guests").insert({
      name,
      birth_year: birthYear,
      phone,
      message,
      status: "대기"
    });
    if (insertResult.error) {
      alert(`게스트 신청 저장 실패: ${insertResult.error.message}`);
      return;
    }
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
  alert("게스트 신청이 접수되었습니다.");
}

async function handleAdminLogin() {
  const email = String(adminEmailInput?.value || "").trim();
  const password = String(adminPasswordInput?.value || "").trim();

  if (!email || !password) {
    alert("운영진 이메일과 비밀번호를 입력해 주세요.");
    return;
  }

  try {
    const client = getAdminAuthClient();
    const signInResult = await client.auth.signInWithPassword({ email, password });
    if (signInResult.error) {
      alert(`${signInResult.error.message}`);
      return;
    }

    const session = signInResult.data?.session;
    const user = signInResult.data?.user;
    const accessToken = session?.access_token || "";

    if (!user || !accessToken) {
      alert("로그인 세션 확인에 실패했습니다.");
      return;
    }

    let profile = null;
    try {
      profile = await loadAdminAccessProfile(client, user.id);
    } catch (error) {
      alert(`권한 확인 실패: ${String(error?.message || error)}`);
      await client.auth.signOut();
      resetAdminSessionState();
      return;
    }

    const isAdmin = profile?.role === "admin" && profile?.approval_status === "approved";
    if (!isAdmin) {
      alert("운영진 권한이 없습니다. 운영진 승인 상태를 확인해 주세요.");
      await client.auth.signOut();
      resetAdminSessionState();
      return;
    }

    try {
      localStorage.setItem(ADMIN_SNAPSHOT_META_KEY, JSON.stringify({
        active: true,
        userId: user.id,
        updatedAt: new Date().toISOString()
      }));
    } catch (_error) {
      // Ignore local snapshot marker failures.
    }
    await openAdminSession({ client, user, accessToken, profile });
  } catch (error) {
    resetAdminSessionState();
    alert(`운영진 로그인 실패: ${String(error?.message || error)}`);
  }
}

async function restoreAdminSession() {
  try {
    const client = getAdminAuthClient();
    const sessionResult = await client.auth.getSession();
    const session = sessionResult.data?.session;
    const user = session?.user || null;
    const accessToken = session?.access_token || "";
    if (!user || !accessToken) {
      resetAdminSessionState();
      return;
    }

    let profile = null;
    try {
      profile = await loadAdminAccessProfile(client, user.id);
    } catch (_error) {
      resetAdminSessionState();
      return;
    }

    if (!(profile?.role === "admin" && profile?.approval_status === "approved")) {
      resetAdminSessionState();
      return;
    }

    await openAdminSession({ client, user, accessToken, profile });
  } catch (_error) {
    resetAdminSessionState();
  }
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
  logAdminAction("공지 등록", title);
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
    isActive: true,
    aliases: [],
    createdAt: new Date().toISOString()
  });

  saveDb();
  renderAll();
  memberForm.reset();
  logAdminAction("회원 추가", `${name} (${birthYear})`);
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
    return { message: "반영할 이름이 없습니다." };
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
    parts.push(`미일치 ${unmatched.length}명`);
  }
  if (ambiguous.length) {
    parts.push(`중복 후보 ${ambiguous.length}명`);
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
    title: `${monthKeyToLabel(schedule.targetMonthKey)} 참여 추첨 결과`,
    content: winners.length > 0
      ? `${winners.map((w) => w.name).join(", ")}님 축하합니다!`
      : `기준(${threshold}회 이상)을 충족한 회원이 없어 당첨자가 없습니다.`,
    createdAt: now.toISOString()
  });

  saveDb();
  renderAll();
  runRouletteAnimation(candidates, winners, schedule.targetMonthKey, threshold, false);
}

function runManualRafflePreview() {
  const schedule = getDrawSchedule(new Date());
  const threshold = getThresholdForMonthKey(schedule.targetMonthKey);
  const candidates = getEligibleMembers(schedule.targetMonthKey);
  const winners = pickWinners(candidates, DRAW_WINNER_COUNT);

  runRouletteAnimation(candidates, winners, schedule.targetMonthKey, threshold, true);
}

function runRouletteAnimation(candidates, winners, monthKey, threshold, isManual) {
  if (!rouletteTrack) {
    return;
  }

  if (!candidates.length) {
    rouletteTrack.textContent = "NO CANDIDATE";
    winnerResult.textContent = `${monthKeyToLabel(monthKey)} 기준 ${threshold}회 이상 출석자가 없습니다.`;
    return;
  }

  let tick = 0;
  let phase = 3;
  winnerResult.textContent = "3초 후 룰렛을 시작합니다.";
  rouletteTrack.textContent = monthKeyToLabel(monthKey);
  const countdownTimer = setInterval(() => {
    phase -= 1;
    if (phase <= 0) {
      clearInterval(countdownTimer);
      startRaffleSpin();
      return;
    }
    winnerResult.textContent = `${phase}초 후 룰렛을 시작합니다.`;
  }, 450);

  function startRaffleSpin() {
    rouletteTrack.classList.add("spinning");
    const timer = setInterval(() => {
      const member = candidates[tick % candidates.length];
      rouletteTrack.textContent = `${member.name} · ${getRaffleBadge(member, monthKey, tick % candidates.length)}`;
      tick += 1;
    }, 90);

    setTimeout(() => {
      clearInterval(timer);
      rouletteTrack.classList.remove("spinning");

      if (!winners.length) {
        rouletteTrack.textContent = "NO WINNER";
        winnerResult.textContent = `${monthKeyToLabel(monthKey)} 당첨자가 없습니다.`;
        return;
      }

      const names = winners.map((winner) => `${winner.name} (${Number(winner.runs || 0)}회)`).join(" / ");
      rouletteTrack.textContent = names;
      winnerResult.textContent = `${isManual ? "테스트" : "자동"} 추첨 완료: ${names}`;
    }, 2600);
  }
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
  renderAuditLogs();
}
function renderNotices() {
  noticeList.innerHTML = "";
  const isAdminView = adminPanel && !adminPanel.classList.contains("hidden");
  const source = isAdminView ? db.notices : (publicNoticeItems.length ? publicNoticeItems : db.notices);

  if (!source.length) {
    noticeList.innerHTML = `<li class="list-item"><p class="list-meta">\uB4F1\uB85D\uB41C \uACF5\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p></li>`;
    return;
  }

  source.forEach((notice) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(notice.title)}</span>
<span class="list-meta">${formatDate(notice.createdAt)}</span></div><p>${escapeHtml(notice.content)}</p>`;

    if (isAdminView) {
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
      logAdminAction("게스트 삭제", `${guest.name} (${guest.phone})`);
    }));

    item.appendChild(actions);
    guestList.appendChild(item);
  });
}

function updateGuestStatus(id, status) {
  const target = db.guests.find((guest) => guest.id === id);
  db.guests = db.guests.map((guest) => (guest.id === id ? { ...guest, status } : guest));
  saveDb();
  renderGuests();
  if (target) {
    logAdminAction("게스트 상태 변경", `${target.name}: ${status}`);
  }
}

function renderMembers() {
  memberList.innerHTML = "";
  if (!db.members.length) {
    memberList.innerHTML = `<li class="list-item"><p class="list-meta">등록된 회원이 없습니다.</p></li>`;
    if (memberFilterMetaNode) {
      memberFilterMetaNode.textContent = "회원 데이터가 없습니다.";
    }
    return;
  }

  updateMemberFilterMeta();

  const monthKey = currentMonthKey();
  const threshold = getThresholdForMonthKey(monthKey);
  const search = normalizeName(memberSearchInput?.value || "");
  const filter = memberFilterSelect?.value || "all";

  const filteredMembers = db.members.filter((member) => {
    const matchesSearch = !search || normalizeName(member.name).includes(search) || (member.aliases || []).some((alias) => normalizeName(alias).includes(search));
    if (!matchesSearch) return false;

    const monthly = getMonthlyRuns(member, monthKey);
    const eligible = monthly >= threshold;
    const risk = computeMemberRisk(member, new Date()).level;
    const unpaid = getFeeStatus(member, feeMonthSelect?.value || currentMonthKey()) !== "paid";

    if (filter === "active") return member.isActive !== false;
    if (filter === "inactive") return member.isActive === false;
    if (filter === "eligible") return eligible;
    if (filter === "warn") return risk === "warn";
    if (filter === "danger") return risk === "danger";
    if (filter === "unpaid") return unpaid;
    return true;
  });

  if (!filteredMembers.length) {
    memberList.innerHTML = `<li class="list-item"><p class="list-meta">검색 조건에 맞는 회원이 없습니다.</p></li>`;
    return;
  }

  filteredMembers.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));

  filteredMembers.forEach((member) => {
    const monthly = getMonthlyRuns(member, monthKey);
    const eligible = monthly >= threshold;
    const risk = computeMemberRisk(member, new Date());
    const accountChips = buildMemberAccountChips(member);
    const accountMeta = buildMemberAccountMeta(member);
    const activeChip = member.isActive === false ? '<span class="status-chip warn">휴면</span>' : '<span class="status-chip">활성</span>';

    const feeOnlyRisk = risk.level !== "ok" && risk.reasons.every((reason) => String(reason).includes("회비"));
    const riskChip = feeOnlyRisk
      ? '<span class="status-chip">회비</span>'
      : risk.level === "danger"
        ? '<span class="status-chip danger">위험</span>'
        : risk.level === "warn"
          ? '<span class="status-chip warn">주의</span>'
          : "";

    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(member.name)} (${member.birthYear})${activeChip}${accountChips}${eligible ? '<span class="status-chip">추첨 대상</span>' : ""}${riskChip}</span><span class="list-meta">이번 달 ${monthly}회 / 누적 ${member.totalRuns}회</span></div><p class="list-meta">${escapeHtml(accountMeta)}</p><p class="list-meta">${feeOnlyRisk ? escapeHtml(risk.reasons.join(" / ")) : ""}</p>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("+1 출석", () => {
      const attendanceDate = getSelectedAttendanceDate();
      updateMemberRuns(member.id, 1, monthKeyFromDate(attendanceDate));
      saveDb();
      logAdminAction("회원 출석 추가", `${member.name} +1 (${attendanceDate})`);
      renderAll();
    }));
    actions.appendChild(buildTinyButton("-1 출석", () => {
      const attendanceDate = getSelectedAttendanceDate();
      updateMemberRuns(member.id, -1, monthKeyFromDate(attendanceDate));
      saveDb();
      logAdminAction("회원 출석 차감", `${member.name} -1 (${attendanceDate})`);
      renderAll();
    }));
    actions.appendChild(buildTinyButton(member.isActive === false ? "활성화" : "휴면", () => {
      const nextActive = member.isActive === false;
      if (!confirmMemberToggleActive(member, nextActive)) {
        return;
      }
      db.members = db.members.map((entry) => entry.id === member.id ? { ...entry, isActive: nextActive } : entry);
      saveDb();
      logAdminAction(nextActive ? "회원 활성화" : "회원 휴면 전환", member.name);
      renderAll();
    }));

    item.appendChild(actions);
    memberList.appendChild(item);
  });
}

function updateMemberFilterMeta() {
  if (!memberFilterMetaNode) {
    return;
  }

  const members = Array.isArray(db.members) ? db.members : [];
  const activeCount = members.filter((member) => member.isActive !== false).length;
  const inactiveCount = members.filter((member) => member.isActive === false).length;
  const linkedCount = members.filter((member) => Boolean(getMemberAccountSummary(member))).length;
  memberFilterMetaNode.textContent = `전체 ${members.length}명 · 활성 ${activeCount}명 · 휴면 ${inactiveCount}명 · 가입 연결 ${linkedCount}명`;
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
    item.innerHTML = `<div class="list-top"><span class="list-title">${log.date} ${escapeHtml(log.eventType)}</span><span class="list-meta">매칭 ${log.matched.length}명 / 미일치 ${log.unmatched.length}명</span></div><p class="list-meta">${log.source === "bulk" ? "일괄" : "빠른"} 등록 | ${formatDate(log.createdAt)}</p><p>${log.matched.length ? `출석: ${escapeHtml(log.matched.join(", "))}` : "출석: 없음"}</p><p class="list-meta">${log.unmatched.length ? `미일치: ${escapeHtml(log.unmatched.join(", "))}` : ""} ${log.ambiguous.length ? `중복 후보: ${escapeHtml(log.ambiguous.join(", "))}` : ""}</p>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    if (Array.isArray(log.matched) && log.matched.length) {
      actions.appendChild(buildTinyButton("되돌리기", () => revertAttendanceLog(log.id)));
    }
    item.appendChild(actions);
    attendanceLogList.appendChild(item);
  });
}


function revertAttendanceLog(logId) {
  const log = db.attendanceLogs.find((entry) => entry.id === logId);
  if (!log || !Array.isArray(log.matched) || !log.matched.length) {
    return;
  }

  const monthKey = monthKeyFromDate(log.date);
  log.matched.forEach((name) => {
    const result = findMemberByName(name);
    if (result.type === "unique") {
      updateMemberRuns(result.member.id, -1, monthKey);
    }
  });

  db.attendanceLogs = db.attendanceLogs.filter((entry) => entry.id !== logId);
  saveDb();
  logAdminAction("출석 되돌리기", `${log.date} ${log.eventType} / ${log.matched.join(", ")}`);
  renderAll();
}

function renderAuditLogs() {
  if (!auditLogList) {
    return;
  }
  auditLogList.innerHTML = "";
  if (!Array.isArray(db.auditLogs) || !db.auditLogs.length) {
    auditLogList.innerHTML = `<li class="list-item"><p class="list-meta">운영 로그가 없습니다.</p></li>`;
    return;
  }

  db.auditLogs.slice(0, 30).forEach((entry) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(entry.action)}</span><span class="list-meta">${formatDate(entry.createdAt)}</span></div><span class="audit-detail">${escapeHtml(entry.actorName || "운영진")} · ${escapeHtml(entry.detail || "")}</span>`;
    auditLogList.appendChild(item);
  });
}

async function logAdminAction(action, detail) {
  const actorName = String(adminEmailInput?.value || "운영진").trim() || "운영진";
  const entry = {
    id: makeId(),
    actorName,
    action,
    detail,
    createdAt: new Date().toISOString()
  };
  db.auditLogs = [entry, ...(Array.isArray(db.auditLogs) ? db.auditLogs : [])].slice(0, 50);
  renderAuditLogs();

  if (!currentAdminToken) {
    return;
  }

  try {
    const client = getAdminAuthClient();
    await client.from("operation_logs").insert({
      actor_user_id: currentAdminUserId || null,
      actor_name: actorName,
      action,
      detail
    });
  } catch (_error) {
    // Keep local log even if remote insert fails.
  }
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
  const membersForFees = [...db.members].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));

  membersForFees.forEach((member) => {
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

  const warningMembers = getOverdueMembers(monthKey, 2).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  if (!warningMembers.length) {
    feeWarningList.innerHTML = `<li class="list-item"><p class="list-meta">연속 미납 경고 없음</p></li>`;
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
  const rows = [["이름", "대상월", "납부상태", "연속미납개월", "누적출석횟수"]];

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
    .filter((member) => member.isActive !== false)
    .map((member) => ({ member, risk: computeMemberRisk(member, new Date()) }))
    .filter((entry) => entry.risk.level !== "ok")
    .sort((a, b) => severityScore(b.risk.level) - severityScore(a.risk.level));

  riskList.innerHTML = "";
  if (!risks.length) {
    riskList.innerHTML = `<li class="list-item"><p class="list-meta">주의 또는 위험 회원이 없습니다.</p></li>`;
    return;
  }

  risks.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(entry.member.name)}</span><span class="list-meta">${entry.risk.level === "danger" ? "위험" : "주의"}</span></div><p class="list-meta">${escapeHtml(entry.risk.reasons.join(" / "))}</p>`;
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
    reasons.push("신규 2주 내 1회 미만 참여");
  }
  if (days > 14 && days <= 21 && monthRuns < 2) {
    level = "danger";
    reasons.push("신규 3주 내 2회 미만 참여");
  }
  if (days > 21) {
    if (dayOfMonth >= 28 && monthRuns < 2) {
      level = "danger";
      reasons.push("월 2회 미만 참여(기존회원)");
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
  const activeMembers = db.members.filter((member) => member.isActive !== false);
  const memberCount = activeMembers.length;
  const monthRunsTotal = activeMembers.reduce((sum, member) => sum + getMonthlyRuns(member, monthKey), 0);
  const avgRuns = memberCount ? monthRunsTotal / memberCount : 0;
  const eligibleCount = getEligibleMembers(monthKey).length;
  const paidCount = activeMembers.filter((member) => getFeeStatus(member, monthKey) === "paid").length;
  const feeRate = memberCount ? (paidCount / memberCount) * 100 : 0;
  const riskCount = activeMembers.filter((member) => computeMemberRisk(member, new Date()).level !== "ok").length;

  statMembers.textContent = `${memberCount}명`;
  statAvgRuns.textContent = avgRuns.toFixed(1);
  statEligible.textContent = `${eligibleCount}명`;
  statFeeRate.textContent = `${feeRate.toFixed(0)}%`;
  statRisk.textContent = `${riskCount}명`;

  const keys = getRecentMonthKeys(6);
  const runSeries = keys.map((key) => ({ key, value: activeMembers.reduce((sum, member) => sum + getMonthlyRuns(member, key), 0) }));
  const feeSeries = keys.map((key) => {
    const paid = activeMembers.filter((member) => getFeeStatus(member, key) === "paid").length;
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
  const nextDrawAt = getNextDrawAt(now);
  const nextSchedule = getDrawSchedule(nextDrawAt);
  const localHistory = Array.isArray(db.raffle?.history) ? db.raffle.history : [];
  const latestRecord = localHistory[0] || null;
  const publicHistory = publicRaffleHistory.length ? publicRaffleHistory : localHistory;
  const nextThreshold = getThresholdForMonthKey(nextSchedule.targetMonthKey);
  const nextEligibleCount = getEligibleMembers(nextSchedule.targetMonthKey).length;

  const ruleText = `${monthKeyToLabel(nextSchedule.targetMonthKey)} 기준: ${nextThreshold}회 이상 출석 시 자동 추첨 대상 (${nextEligibleCount}명)`;
  const publicRuleText = `${monthKeyToLabel(nextSchedule.targetMonthKey)} 기준: ${nextThreshold}회 이상 출석 시 매월 5일 자동 추첨됩니다.`;
  const nextText = `다음 자동 추첨: ${formatDateTime(nextDrawAt)} (매월 5일 12:00)`;

  if (raffleRule) {
    raffleRule.textContent = ruleText;
  }
  if (nextDraw) {
    nextDraw.textContent = nextText;
  }
  if (publicRaffleRule) {
    publicRaffleRule.textContent = publicRuleText;
  }
  if (publicNextDraw) {
    publicNextDraw.textContent = nextText;
  }

  const candidatePreview = getEligibleMembers(nextSchedule.targetMonthKey)
    .sort((a, b) => getMonthlyRuns(b, nextSchedule.targetMonthKey) - getMonthlyRuns(a, nextSchedule.targetMonthKey) || String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .slice(0, 8);

  renderRaffleCandidates(raffleCandidates, candidatePreview, nextSchedule.targetMonthKey, latestRecord);
  renderRaffleCandidates(publicRaffleCandidates, candidatePreview, nextSchedule.targetMonthKey, latestRecord);
  renderRaffleSpotlight(publicRaffleSpotlight, latestRecord);
  renderRaffleHistoryList(winnerHistory, localHistory);
  renderRaffleHistoryList(publicWinnerHistory, publicHistory);

  if (winnerResult && latestRecord) {
    winnerResult.textContent = `${monthKeyToLabel(latestRecord.targetMonthKey)} 최근 추첨 결과가 반영되어 있습니다.`;
  }
}

function renderRaffleHistoryList(target, history = []) {
  if (!target) {
    return;
  }
  target.innerHTML = "";
  if (!history.length) {
    target.innerHTML = `<li class="list-item"><p class="list-meta">추첨 기록이 없습니다.</p></li>`;
    return;
  }

  history.forEach((record) => {
    const winners = Array.isArray(record.winners) ? record.winners : [];
    const names = winners.length ? winners.map((winner) => winner.name).join(", ") : "당첨자 없음";
    const item = document.createElement("li");
    item.className = "raffle-history-card";
    item.innerHTML = `<div class="list-top"><span class="list-title">${monthKeyToLabel(record.targetMonthKey)} 추첨</span><span class="list-meta">${formatDate(record.createdAt)}</span></div><p class="list-meta">기준 ${record.threshold}회 / ${record.winnerCount}명 추첨</p><p class="raffle-history-names">${escapeHtml(names)}</p>`;
    target.appendChild(item);
  });
}

function renderRaffleCandidates(target, candidates = [], monthKey, latestRecord = null) {
  if (!target) {
    return;
  }
  target.innerHTML = "";
  if (!candidates.length) {
    target.innerHTML = `<div class="raffle-candidate-card"><strong>후보 준비 중</strong><p class="list-meta">${monthKeyToLabel(monthKey)} 기준 후보가 아직 없습니다.</p></div>`;
    return;
  }

  const winnerIds = new Set(Array.isArray(latestRecord?.winners) ? latestRecord.winners.map((winner) => winner.id) : []);
  candidates.forEach((member, index) => {
    const card = document.createElement("article");
    const badge = getRaffleBadge(member, monthKey, index);
    const isWinner = winnerIds.has(member.id);
    card.className = `raffle-candidate-card${isWinner ? " is-winner" : ""}`;
    card.innerHTML = `<strong>${escapeHtml(member.name)}</strong><span class="list-meta">${getMonthlyRuns(member, monthKey)}회 출석 · ${badge}</span><span class="list-meta">누적 ${Number(member.totalRuns || 0)}회</span>`;
    target.appendChild(card);
  });
}

function renderRaffleSpotlight(target, record) {
  if (!target) {
    return;
  }
  if (!record) {
    target.innerHTML = `<p class="list-meta">첫 추첨이 진행되면 이달의 하이라이트가 여기에 표시됩니다.</p>`;
    return;
  }

  const winners = Array.isArray(record.winners) ? record.winners : [];
  const headline = winners.length ? winners.map((winner) => winner.name).join(" / ") : "당첨자 없음";
  target.innerHTML = `<p class="list-meta">최근 하이라이트</p><h4>${escapeHtml(headline)}</h4><div class="raffle-winner-tags">${winners.map((winner) => `<span class="raffle-tag">${escapeHtml(winner.name)} · ${Number(winner.runs || 0)}회</span>`).join("") || '<span class="raffle-tag">기준 충족자 없음</span>'}</div>`;
}

function getRaffleBadge(member, monthKey, index) {
  const runs = getMonthlyRuns(member, monthKey);
  if (runs >= 8) return "출석 에이스";
  if (runs >= 6) return "꾸준 러너";
  if (index === 0) return "선두 후보";
  return "룰렛 후보";
}
function getEligibleMembers(monthKey) {
  const threshold = getThresholdForMonthKey(monthKey);
  return db.members.filter((member) => member.isActive !== false && getMonthlyRuns(member, monthKey) >= threshold);
}

function getDrawSchedule(now) {
  return {
    drawId: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    targetMonthKey: previousMonthKey(now),
    scheduledAt: new Date(now.getFullYear(), now.getMonth(), 5, 12, 0, 0, 0)
  };
}

function getNextDrawAt(now) {
  const thisMonthDrawAt = new Date(now.getFullYear(), now.getMonth(), 5, 12, 0, 0, 0);
  if (now < thisMonthDrawAt) {
    return thisMonthDrawAt;
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 5, 12, 0, 0, 0);
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
      attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
    };
  } catch (error) {
    console.error("DB load failed", error);
    return structuredClone(defaultData);
  }
}

function saveDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  touchAdminSnapshotMeta();
}

function touchAdminSnapshotMeta() {
  if (!currentAdminUserId) {
    return;
  }

  try {
    localStorage.setItem(ADMIN_SNAPSHOT_META_KEY, JSON.stringify({
      active: true,
      userId: currentAdminUserId,
      updatedAt: new Date().toISOString()
    }));
  } catch (_error) {
    // Ignore local snapshot cache write failures.
  }
}

function scheduleAutoSync() {
  // Disabled intentionally.
  // 운영 데이터는 명시적으로 "지금 동기화"를 눌렀을 때만 Supabase에 반영합니다.
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



function buildSupabaseSyncPayload() {
  const members = (Array.isArray(db.members) ? db.members : []).map((member) => ({
    name: String(member.name || "이름없음"),
    birth_year: Number(member.birthYear || 1994),
    total_runs: Number(member.totalRuns || 0),
    monthly_runs: member.monthlyRuns && typeof member.monthlyRuns === "object" ? member.monthlyRuns : {},
    fee_status: member.feeStatus && typeof member.feeStatus === "object" ? member.feeStatus : {},
    aliases: Array.isArray(member.aliases) ? member.aliases : [],
    is_active: member.isActive !== false
  }));

  const notices = (Array.isArray(db.notices) ? db.notices : []).map((notice) => ({
    title: String(notice.title || "공지"),
    content: String(notice.content || ""),
    created_at: notice.createdAt || new Date().toISOString()
  }));

  const guests = (Array.isArray(db.guests) ? db.guests : []).map((guest) => ({
    name: String(guest.name || "게스트"),
    birth_year: Number(guest.birthYear || 1994),
    phone: String(guest.phone || ""),
    message: String(guest.message || ""),
    status: String(guest.status || "대기"),
    created_at: guest.createdAt || new Date().toISOString()
  }));

  const attendance_logs = (Array.isArray(db.attendanceLogs) ? db.attendanceLogs : []).map((log) => ({
    source: String(log.source || "bulk"),
    event_type: String(log.eventType || "정기런"),
    attendance_date: String(log.date || toIsoDate(new Date())),
    raw_count: Number(log.rawCount || 0),
    matched: Array.isArray(log.matched) ? log.matched : [],
    unmatched: Array.isArray(log.unmatched) ? log.unmatched : [],
    ambiguous: Array.isArray(log.ambiguous) ? log.ambiguous : [],
    created_at: log.createdAt || new Date().toISOString()
  }));

  const raffle_history = (Array.isArray(db.raffle?.history) ? db.raffle.history : []).map((record) => ({
    draw_id: String(record.drawId || makeId()),
    target_month_key: String(record.targetMonthKey || currentMonthKey()),
    threshold: Math.max(0, Number(record.threshold || 0)),
    winner_count: Math.max(0, Number(record.winnerCount || 0)),
    winners: Array.isArray(record.winners) ? record.winners : [],
    created_at: record.createdAt || new Date().toISOString()
  }));

  return { members, notices, guests, attendance_logs, raffle_history };
}

function getMeaningfulMemberPayloadCount(members) {
  return (Array.isArray(members) ? members : []).filter((member) => {
    const name = String(member?.name || "").trim();
    return Boolean(name) && name !== "샘플회원";
  }).length;
}

async function loadRemoteMemberCount() {
  const client = getAdminAuthClient();
  const result = await client
    .from("members")
    .select("id", { count: "exact", head: true });

  if (result.error) {
    throw result.error;
  }

  return Number(result.count || 0);
}

async function refreshSyncOverview() {
  if (!syncMeta || !currentAdminToken) {
    return;
  }

  try {
    const localCount = Array.isArray(db.members)
      ? db.members.filter((member) => String(member?.name || "").trim() && String(member?.name || "").trim() !== "샘플회원").length
      : 0;
    const remoteCount = await loadRemoteMemberCount();
    const baseText = String(syncMeta.textContent || "마지막 동기화: 기록 없음").split(" · 로컬 ")[0];
    syncMeta.textContent = `${baseText} · 로컬 ${localCount}명 / 원격 ${remoteCount}명`;
  } catch (_error) {
    // Keep current sync meta if count fetch fails.
  }
}

async function syncDataToSupabase() {
  if (!currentAdminToken) {
    alert("운영진 로그인 후 이용해 주세요.");
    return;
  }
  if (syncSupabaseButton) {
    syncSupabaseButton.disabled = true;
  }
  if (syncStatus) {
    syncStatus.textContent = "동기화 중...";
  }

  try {
    const payload = buildSupabaseSyncPayload();
    const localMemberCount = getMeaningfulMemberPayloadCount(payload.members);
    const remoteMemberCount = await loadRemoteMemberCount();

    if (localMemberCount === 0) {
      throw new Error("현재 브라우저의 회원 데이터가 비어 있어 동기화를 차단했습니다. 회원 목록 복구 후 다시 시도해 주세요.");
    }

    const suspiciousDrop = remoteMemberCount >= 5 && localMemberCount < Math.ceil(remoteMemberCount * 0.7);
    if (suspiciousDrop) {
      throw new Error(`원격 회원 ${remoteMemberCount}명 대비 현재 브라우저 회원이 ${localMemberCount}명뿐이라 덮어쓰기를 차단했습니다. 다른 브라우저 데이터 또는 회원 목록 복구를 먼저 확인해 주세요.`);
    }

    const confirmed = confirm(`지금 동기화할까요?\n\n로컬 회원 ${localMemberCount}명 / 원격 회원 ${remoteMemberCount}명\n이 작업은 Supabase 운영 데이터를 현재 브라우저 상태로 덮어씁니다.`);
    if (!confirmed) {
      if (syncStatus) {
        syncStatus.textContent = "동기화를 취소했습니다.";
      }
      return;
    }

    const response = await fetch("/.netlify/functions/admin-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "unknown");
    }

    if (syncStatus) {
      syncStatus.textContent = `동기화 완료: members ${result.counts?.members || 0}, notices ${result.counts?.notices || 0}, guests ${result.counts?.guests || 0}, raffle ${result.counts?.raffle_history || 0}`;
    }
    loadSyncMetadata();
    loadPublicNoticeData();
    loadPublicRaffleData();
  } catch (error) {
    if (syncStatus) {
      syncStatus.textContent = `동기화 실패: ${String(error.message || error)}`;
    }
  } finally {
    if (syncSupabaseButton) {
      syncSupabaseButton.disabled = false;
    }
  }
}

async function restoreLastSyncBackup() {
  if (!currentAdminToken) {
    alert("운영진 로그인 후 이용해 주세요.");
    return;
  }

  const confirmed = confirm("마지막 자동 백업 상태로 Supabase 운영 데이터를 복원할까요?\n\n최근 동기화 이후 변경한 공지/회원/게스트/출석 기록도 함께 되돌아갈 수 있습니다.");
  if (!confirmed) {
    return;
  }

  if (restoreBackupButton) {
    restoreBackupButton.disabled = true;
  }
  if (syncStatus) {
    syncStatus.textContent = "마지막 백업에서 복원 중...";
  }

  try {
    const response = await fetch("/.netlify/functions/restore-sync-backup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "unknown");
    }

    await loadAdminSnapshot();
    renderAll();
    if (syncStatus) {
      syncStatus.textContent = `백업 복원 완료: members ${result.counts?.members || 0}, notices ${result.counts?.notices || 0}, guests ${result.counts?.guests || 0}, raffle ${result.counts?.raffle_history || 0}`;
    }
    loadSyncMetadata();
  } catch (error) {
    if (syncStatus) {
      syncStatus.textContent = `백업 복원 실패: ${String(error.message || error)}`;
    }
  } finally {
    if (restoreBackupButton) {
      restoreBackupButton.disabled = false;
    }
  }
}

async function recoverMembersFromProfiles() {
  if (!currentAdminToken) {
    alert("운영진 로그인 후 이용해 주세요.");
    return;
  }

  const confirmed = confirm("승인된 회원 프로필과 출석 로그를 기준으로 회원 목록을 복구할까요? 현재 members 테이블이 복구 결과로 교체됩니다.");
  if (!confirmed) {
    return;
  }

  if (recoverMembersButton) {
    recoverMembersButton.disabled = true;
  }
  if (syncStatus) {
    syncStatus.textContent = "회원 목록 복구 중...";
  }

  try {
    const response = await fetch("/.netlify/functions/recover-members", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "unknown");
    }

    await loadAdminSnapshot();
    renderAll();
    if (syncStatus) {
      syncStatus.textContent = `회원 복구 완료: ${result.counts?.members || 0}명 복구, 승인 프로필 ${result.counts?.profiles || 0}건, 출석 로그 ${result.counts?.attendance_logs || 0}건 반영`;
    }
    loadSyncMetadata();
  } catch (error) {
    if (syncStatus) {
      syncStatus.textContent = `회원 복구 실패: ${String(error.message || error)}`;
    }
  } finally {
    if (recoverMembersButton) {
      recoverMembersButton.disabled = false;
    }
  }
}

async function loadApprovalQueue() {
  if (!approvalList) {
    return;
  }
  if (!currentAdminToken) {
    approvalList.innerHTML = '<li class="list-item"><p class="list-meta">운영진 로그인 후 볼 수 있습니다.</p></li>';
    return;
  }

  approvalList.innerHTML = '<li class="list-item"><p class="list-meta">불러오는 중...</p></li>';

  try {
    const response = await fetch("/.netlify/functions/member-approval?action=list", {
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      approvalList.innerHTML = `<li class="list-item"><p class="list-meta">로드 실패: ${escapeHtml(result.error || "unknown")}</p></li>`;
      return;
    }

    currentAdminCanManageRoles = Boolean(result.can_manage_roles);
    const list = Array.isArray(result.items) ? result.items : [];
    if (!list.length) {
      approvalList.innerHTML = '<li class="list-item"><p class="list-meta">승인 대기자가 없습니다.</p></li>';
      return;
    }

    approvalList.innerHTML = "";
    list.forEach((item) => {
      const row = document.createElement("li");
      row.className = "list-item";
      row.innerHTML = `
        <div class="list-top">
          <span class="list-title">${escapeHtml(item.name || "이름없음")} (${item.birth_year || "-"})</span>
          <span class="list-meta">${escapeHtml(formatApprovalStatusLabel(item.approval_status))} / ${escapeHtml(formatRoleLabel(item.role))}</span>
        </div>
        <p class="list-meta">${escapeHtml(item.email || "")}</p>
        <p>${escapeHtml(item.intro || "-")}</p>
      `;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      const approveButton = buildTinyButton("승인", () => updateApprovalStatus(item.user_id, "approved"));
      const rejectButton = buildTinyButton("반려", () => updateApprovalStatus(item.user_id, "rejected"));
      const adminButton = buildTinyButton("운영진", () => updateApprovalStatus(item.user_id, "approved", "admin"));
      if (!currentAdminCanManageRoles) {
        adminButton.disabled = true;
        adminButton.title = "오너만 운영진 권한을 부여할 수 있습니다.";
      }
      actions.appendChild(approveButton);
      actions.appendChild(rejectButton);
      actions.appendChild(adminButton);
      row.appendChild(actions);

      approvalList.appendChild(row);
    });
  } catch (error) {
    approvalList.innerHTML = `<li class="list-item"><p class="list-meta">로드 실패: ${escapeHtml(String(error.message || error))}</p></li>`;
  }
}

async function loadRoleList() {
  if (!roleList) {
    return;
  }
  if (!currentAdminToken) {
    roleList.innerHTML = '<li class="list-item"><p class="list-meta">운영진 로그인 후 볼 수 있습니다.</p></li>';
    return;
  }

  roleList.innerHTML = '<li class="list-item"><p class="list-meta">불러오는 중...</p></li>';

  try {
    const response = await fetch("/.netlify/functions/member-approval?action=list-all", {
      headers: {
        Authorization: `Bearer ${currentAdminToken}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "unknown");
    }

    const items = Array.isArray(result.items) ? result.items : [];
    currentAdminCanManageRoles = Boolean(result.can_manage_roles);
    roleList.innerHTML = "";
    if (!items.length) {
      roleList.innerHTML = '<li class="list-item"><p class="list-meta">회원 권한 정보가 없습니다.</p></li>';
      return;
    }

    if (roleStatus) {
      roleStatus.textContent = buildAdminRoleStatusText("admin", "approved", currentAdminCanManageRoles);
    }

    items.slice(0, 200).forEach((item) => {
      const row = document.createElement("li");
      row.className = "list-item";
      const isMe = item.user_id === currentAdminUserId;
      row.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(item.name || "이름없음")}${isMe ? " (나)" : ""}</span><span class="list-meta">${escapeHtml(formatRoleLabel(item.role, isMe && currentAdminCanManageRoles))}</span></div><p class="list-meta">${escapeHtml(item.email || "")}</p><p class="list-meta">상태: ${escapeHtml(formatApprovalStatusLabel(item.approval_status))}</p>`;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      const promoteButton = buildTinyButton("운영진 승격", () => updateMemberRole(item.user_id, "admin", item.name || "회원"));
      const demoteButton = buildTinyButton("일반회원", () => updateMemberRole(item.user_id, "member", item.name || "회원"));
      if (!currentAdminCanManageRoles) {
        promoteButton.disabled = true;
        demoteButton.disabled = true;
        promoteButton.title = "오너만 권한을 변경할 수 있습니다.";
        demoteButton.title = "오너만 권한을 변경할 수 있습니다.";
      }
      actions.appendChild(promoteButton);
      actions.appendChild(demoteButton);
      row.appendChild(actions);

      roleList.appendChild(row);
    });
  } catch (error) {
    roleList.innerHTML = `<li class="list-item"><p class="list-meta">로드 실패: ${escapeHtml(String(error.message || error))}</p></li>`;
  }
}

async function updateMemberRole(userId, role, displayName = "회원") {
  if (!currentAdminToken) {
    return;
  }
  if (!currentAdminCanManageRoles) {
    alert("오너 권한이 필요합니다.");
    return;
  }
  if (userId === currentAdminUserId && role !== "admin") {
    alert("본인 계정은 일반회원으로 변경할 수 없습니다.");
    return;
  }

  const roleLabel = role === "admin" ? "운영진" : "일반회원";
  const approvalNotice = role === "admin" ? "\n운영진 승격 시 승인 상태도 함께 '승인'으로 맞춥니다." : "";
  const confirmed = confirm(`${displayName}님의 권한을 ${roleLabel}으로 변경할까요?${approvalNotice}`);
  if (!confirmed) {
    return;
  }

  const payload = role === "admin"
    ? { user_id: userId, role, approval_status: "approved" }
    : { user_id: userId, role };

  const response = await fetch("/.netlify/functions/member-approval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentAdminToken}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    alert(`권한 변경 실패: ${result.error || "unknown"}`);
    return;
  }

  await loadAdminSnapshot();
  loadApprovalQueue();
  loadRoleList();
  renderAll();
}

async function updateApprovalStatus(userId, status, role = null) {
  if (!currentAdminToken) {
    return;
  }
  if (role === "admin" && !currentAdminCanManageRoles) {
    alert("운영진 권한 부여는 오너만 가능합니다.");
    return;
  }

  if (role === "admin") {
    const confirmed = confirm("이 회원에게 운영진 권한을 부여할까요?");
    if (!confirmed) {
      return;
    }
  }

  const payload = { user_id: userId, approval_status: status };
  if (role) {
    payload.role = role;
  }

  const response = await fetch("/.netlify/functions/member-approval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentAdminToken}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    alert(`승인 상태 변경 실패: ${result.error || "unknown"}`);
    return;
  }

  await loadAdminSnapshot();
  loadApprovalQueue();
  loadRoleList();
  renderAll();
}












































