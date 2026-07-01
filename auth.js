const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PUBLIC_LOGIN_URL = "https://rrc-seoul.netlify.app/login.html";
const PENDING_SIGNUP_PREFIX = "rrc-pending-signup:";
const ADMIN_SNAPSHOT_META_KEY = "rrc-admin-snapshot-meta-v1";
const LOCAL_ADMIN_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BIRTH_YEAR_MIN = 1989;
const BIRTH_YEAR_MAX = 2004;
const POINT_WON_RATE = 10;
const ATTENDANCE_STREAK_START_MONTH = "2026-04";
const POINT_POLICY = {
  signupBonus: 20,
  monthlyRunner: 100,
  monthlyCandidate: 30,
  venueLover: 50,
  candidateStreak2: 30,
  candidateStreak3: 50
};
const REWARD_ITEMS = [
  { code: "rrc_shop_5000", name: "활동 혜택 5,000원권", points: 500 },
  { code: "rrc_shop_10000", name: "활동 혜택 10,000원권", points: 1000 },
  { code: "rrc_shop_20000", name: "활동 혜택 20,000원권", points: 2000 }
];

let supabaseClient = null;
let authUser = null;
let authProfile = null;
const yearNode = document.getElementById("year");

const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupPasswordConfirmInput = document.getElementById("signup-password-confirm");
const signupNameInput = document.getElementById("signup-name");
const signupBirthYearInput = document.getElementById("signup-birth-year");
const signupIntroInput = document.getElementById("signup-intro");
const signupAgreeInput = document.getElementById("signup-agree");
const signupForm = document.getElementById("signup-form");
const signupSubmitButton = document.getElementById("signup-submit");
const signupStatus = document.getElementById("signup-status");

const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginSubmitButton = document.getElementById("login-submit");
const loginLogoutButton = document.getElementById("login-logout");
const loginStatus = document.getElementById("login-status");
const loginApprovalStatus = document.getElementById("login-approval-status");
const loginPanel = document.getElementById("login-panel");
const loginPanelTitle = document.getElementById("login-panel-title");
const loginPanelCopy = document.getElementById("login-panel-copy");
const loginForm = document.getElementById("login-form");
const loginGuestActions = document.getElementById("login-guest-actions");
const loginMemberActions = document.getElementById("login-member-actions");
const authShell = document.querySelector(".auth-shell");

const activityMonthSelect = document.getElementById("activity-month");
const activityRefreshButton = document.getElementById("activity-refresh");
const activityLock = document.getElementById("activity-lock");
const activityBoard = document.getElementById("activity-board");
const activityQuickActions = document.querySelectorAll("[data-quick-board-tab]");
const memberFocusPanel = document.querySelector(".member-focus-panel");
const raffleStagePanel = document.querySelector(".raffle-stage-panel");
const activityPrimaryGrid = document.querySelector(".activity-primary-grid");
const memberFeatureGuide = document.getElementById("member-feature-guide");
const boardPulseGrid = document.querySelector(".board-pulse-grid");
const boardLayout = document.querySelector(".board-layout");
const boardPublicGrid = document.querySelector(".board-public-grid");
const boardRecordGrid = document.querySelector(".board-record-grid");
const rewardSectionLabel = document.querySelector(".reward-section-label");
const challengeSectionLabel = document.querySelector(".challenge-section-label");
const suggestionSectionLabel = document.querySelector(".suggestion-section-label");
const rewardBoardGrid = document.querySelector(".reward-board-grid");
const challengeBoardGrid = document.querySelector(".challenge-board-grid");
const suggestionBoardGrid = document.querySelector(".suggestion-board-grid");
const myMonthRuns = document.getElementById("my-month-runs");
const myTotalRuns = document.getElementById("my-total-runs");
const myStreak = document.getElementById("my-streak");
const runnerMonthLabel = document.getElementById("runner-month-label");
const runnerCard = document.getElementById("runner-card");
const attendanceBoard = document.getElementById("attendance-board");
const publicTicketBoard = document.getElementById("public-ticket-board");
const candidatePreviewBoard = document.getElementById("candidate-preview-board");
const badgeShowcaseBoard = document.getElementById("badge-showcase-board");
const boardRaffleHistory = document.getElementById("board-raffle-history");
const raffleStageHype = document.getElementById("raffle-stage-hype");
let boardRaffleReplayPanel = null;
let boardRaffleReplayStatus = null;
let boardRaffleReplayButton = null;
let boardRaffleRouletteTrack = null;
let latestRaffleRecords = [];
let activityBoardRuntime = null;
let activityBoardTabLoads = new Set();
let rewardAvailablePointCache = 0;
let rewardAvailableBeforeChallengeLockCache = 0;
let challengeLockedPointCache = 0;
let rewardBalanceSnapshot = { earnedPoints: 0, usedPoints: 0, pendingPoints: 0 };
const myFeeStatus = document.getElementById("my-fee-status");
const myRaffleStatus = document.getElementById("my-raffle-status");
const myStreakChange = document.getElementById("my-streak-change");
const myBadges = document.getElementById("my-badges");
const myTicketCount = document.getElementById("my-ticket-count");
const myPointTotal = document.getElementById("my-point-total");
const myNextReward = document.getElementById("my-next-reward");
const myPointNote = document.getElementById("my-point-note");
const boardCandidateCount = document.getElementById("board-candidate-count");
const boardCandidateNote = document.getElementById("board-candidate-note");
const boardTopRunner = document.getElementById("board-top-runner");
const boardTopRunnerNote = document.getElementById("board-top-runner-note");
const boardPointLeader = document.getElementById("board-point-leader");
const boardPointLeaderNote = document.getElementById("board-point-leader-note");
const pointRankingBoard = document.getElementById("point-ranking-board");
const pointRankingYearBoard = document.getElementById("point-ranking-year-board");
const myRaffleHistory = document.getElementById("my-raffle-history");
const myPointAwardHistory = document.getElementById("my-point-award-history");
const myAttendanceNote = document.getElementById("my-attendance-note");
const myAttendanceHistory = document.getElementById("my-attendance-history");
const attendanceReportForm = document.getElementById("attendance-report-form");
const attendanceReportDateInput = document.getElementById("attendance-report-date");
const attendanceReportTypeInput = document.getElementById("attendance-report-type");
const attendanceReportNoteInput = document.getElementById("attendance-report-note");
const attendanceReportSubmitButton = document.getElementById("attendance-report-submit");
const attendanceReportStatus = document.getElementById("attendance-report-status");
const suggestionForm = document.getElementById("suggestion-form");
const suggestionTitleInput = document.getElementById("suggestion-title");
const suggestionContentInput = document.getElementById("suggestion-content");
const suggestionAnonymousInput = document.getElementById("suggestion-anonymous");
const suggestionSubmitButton = document.getElementById("suggestion-submit");
const suggestionRefreshButton = document.getElementById("suggestion-refresh");
const suggestionStatus = document.getElementById("suggestion-status");
const suggestionList = document.getElementById("suggestion-list");
const rewardRequestForm = document.getElementById("reward-request-form");
const rewardRequestItem = document.getElementById("reward-request-item");
const rewardRequestNote = document.getElementById("reward-request-note");
const rewardRequestSubmitButton = document.getElementById("reward-request-submit");
const rewardRequestRefreshButton = document.getElementById("reward-request-refresh");
const rewardRequestStatus = document.getElementById("reward-request-status");
const rewardRequestList = document.getElementById("reward-request-list");
const rewardPreviewList = document.getElementById("reward-preview-list");
const rewardBalanceTotal = document.getElementById("reward-balance-total");
const rewardBalanceUsed = document.getElementById("reward-balance-used");
const rewardBalanceAvailable = document.getElementById("reward-balance-available");
const rewardBalanceNote = document.getElementById("reward-balance-note");
const challengeForm = document.getElementById("challenge-form");
const challengeModeInput = document.getElementById("challenge-mode");
const challengeModeDescription = document.getElementById("challenge-mode-description");
const challengeTitleInput = document.getElementById("challenge-title");
const challengeStakeInput = document.getElementById("challenge-stake");
const challengeSuccessRewardInput = document.getElementById("challenge-success-reward");
const challengeMinParticipantsInput = document.getElementById("challenge-min-participants");
const challengeTagInput = document.getElementById("challenge-tag");
const challengeVerificationMethodInput = document.getElementById("challenge-verification-method");
const challengeFailurePolicyInput = document.getElementById("challenge-failure-policy");
const challengeRecruitStartInput = document.getElementById("challenge-recruit-start");
const challengeRecruitEndInput = document.getElementById("challenge-recruit-end");
const challengeStartInput = document.getElementById("challenge-start");
const challengeEndInput = document.getElementById("challenge-end");
const challengeRuleInput = document.getElementById("challenge-rule");
const challengeSubmitButton = document.getElementById("challenge-submit");
const challengeRefreshButton = document.getElementById("challenge-refresh");
const challengeStatus = document.getElementById("challenge-status");
const challengeList = document.getElementById("challenge-list");
const pointAwardPanel = document.getElementById("point-award-panel");
const pointAwardForm = document.getElementById("point-award-form");
const pointAwardMemberInput = document.getElementById("point-award-member");
const pointAwardMonthInput = document.getElementById("point-award-month");
const pointAwardCodeInput = document.getElementById("point-award-code");
const pointAwardPointsInput = document.getElementById("point-award-points");
const pointAwardNoteInput = document.getElementById("point-award-note");
const pointAwardSubmitButton = document.getElementById("point-award-submit");
const pointAwardRefreshButton = document.getElementById("point-award-refresh");
const pointAwardStatus = document.getElementById("point-award-status");
const pointAwardList = document.getElementById("point-award-list");
const memberNavLinks = document.querySelectorAll("[data-member-nav]");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");
const authEntryLinks = document.querySelectorAll("[data-auth-entry]");
if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}
init();

function publishAuthState() {
  try {
    const snapshot = { user: authUser || null, profile: authProfile || null };
    window.__RRC_AUTH_STATE = snapshot;
    window.dispatchEvent(new CustomEvent("rrc-auth-state", { detail: snapshot }));
  } catch (_error) {
    // Ignore event publishing failures.
  }
}



function getPostLoginRedirectUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const next = String(params.get("next") || "").trim();
    if (next === "board") {
      return "login.html#activity-board";
    }
    return "";
  } catch (_error) {
    return "";
  }
}

function redirectAfterLoginIfNeeded() {
  const redirectUrl = getPostLoginRedirectUrl();
  if (!redirectUrl) {
    return false;
  }
  window.location.href = redirectUrl;
  return true;
}
function init() {
  markCurrentNavigation();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setStatus(loginStatus, "설정 필요: auth.js 상단의 SUPABASE 값을 입력해 주세요.");
    setStatus(signupStatus, "설정 필요: auth.js 상단의 SUPABASE 값을 입력해 주세요.");
    disablePhotoUpload();
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    setStatus(loginStatus, "Supabase 라이브러리를 불러오지 못했습니다.");
    setStatus(signupStatus, "Supabase 라이브러리를 불러오지 못했습니다.");
    disablePhotoUpload();
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "rrc-auth"
    }
  });
  window.__RRC_SUPABASE_CLIENT = supabaseClient;

  signupForm?.addEventListener("submit", handleSignup);
  loginForm?.addEventListener("submit", handleLogin);
  loginLogoutButton?.addEventListener("click", handleLogout);
  activityRefreshButton?.addEventListener("click", loadActivityBoard);
  activityMonthSelect?.addEventListener("change", loadActivityBoard);
  configureActivityBoardTabs();
  attendanceReportForm?.addEventListener("submit", handleAttendanceReportSubmit);
  attachDatePickerOpen(attendanceReportDateInput);
  suggestionForm?.addEventListener("submit", handleSuggestionSubmit);
  suggestionRefreshButton?.addEventListener("click", loadSuggestionBoard);
  rewardRequestForm?.addEventListener("submit", handleRewardRequestSubmit);
  rewardRequestRefreshButton?.addEventListener("click", loadRewardRequests);
  challengeForm?.addEventListener("submit", handleChallengeSubmit);
  challengeModeInput?.addEventListener("change", syncChallengeModeFields);
  challengeRefreshButton?.addEventListener("click", loadChallenges);
  attachDatePickerOpen(challengeRecruitStartInput);
  attachDatePickerOpen(challengeRecruitEndInput);
  attachDatePickerOpen(challengeStartInput);
  attachDatePickerOpen(challengeEndInput);
  pointAwardForm?.addEventListener("submit", handlePointAwardSubmit);
  pointAwardRefreshButton?.addEventListener("click", loadPointAwards);
  pointAwardCodeInput?.addEventListener("change", syncPointAwardDefaults);

  if (activityMonthSelect) {
    populateRecentMonthOptions(activityMonthSelect);
  }
  if (pointAwardMonthInput) {
    pointAwardMonthInput.value = currentMonthKey();
  }
  syncPointAwardDefaults();
  syncChallengeModeFields();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    void hydrateAuthState(session?.user || null);
  });

  void hydrateAuthState();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !supabaseClient) {
      return;
    }
    void hydrateAuthState();
  });
}

function markCurrentNavigation() {
  const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-links a[href]").forEach((link) => {
    const rawHref = String(link.getAttribute("href") || "");
    if (!rawHref || rawHref.startsWith("http")) {
      return;
    }
    const hrefPath = rawHref.split("#")[0].toLowerCase();
    const isCurrent = currentPath === (hrefPath || currentPath);
    link.classList.toggle("is-current", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function attachDatePickerOpen(input) {
  if (!input || input.type !== "date") {
    return;
  }
  const openPicker = () => {
    try {
      input.focus();
      if (typeof input.showPicker === "function") {
        input.showPicker();
      }
    } catch (_error) {
      input.focus();
    }
  };
  input.addEventListener("click", openPicker);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });
}

function configureActivityBoardTabs() {
  if (!activityBoard || activityBoard.dataset.tabsReady === "1") {
    return;
  }
  activityBoard.dataset.tabsReady = "1";

  const controls = activityMonthSelect?.closest(".inline-form");
  if (controls) {
    controls.classList.add("activity-month-controls");
    controls.insertAdjacentHTML("afterbegin", '<span class="activity-month-label">조회 월</span>');
  }

  const tabs = [
    { key: "overview", label: "요약", nodes: [memberFocusPanel, raffleStagePanel, boardPulseGrid] },
    { key: "attendance", label: "출석", nodes: [boardLayout, boardPublicGrid] },
    { key: "raffle", label: "추첨", nodes: [raffleStagePanel] },
    { key: "rewards", label: "포인트", nodes: [boardRecordGrid, rewardSectionLabel, rewardBoardGrid] },
    { key: "challenges", label: "챌린지", nodes: [challengeSectionLabel, challengeBoardGrid] },
    { key: "suggestions", label: "건의함", nodes: [suggestionSectionLabel, suggestionBoardGrid] }
  ];

  boardRaffleReplayPanel = buildRaffleReplayPanel();
  if (boardLayout) {
    boardLayout.insertAdjacentElement("afterend", boardRaffleReplayPanel);
  } else {
    activityBoard.appendChild(boardRaffleReplayPanel);
  }
  tabs.find((tab) => tab.key === "raffle").nodes = [boardRaffleReplayPanel];

  const tabbar = document.createElement("div");
  tabbar.className = "activity-board-tabs";
  tabbar.setAttribute("role", "tablist");
  tabbar.setAttribute("aria-label", "활동 보드 보기 선택");
  tabbar.innerHTML = tabs.map((tab, index) => `<button class="activity-board-tab${index === 0 ? " is-active" : ""}" type="button" role="tab" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}" data-board-tab="${tab.key}">${tab.label}</button>`).join("");
  if (controls) {
    controls.insertAdjacentElement("afterend", tabbar);
  } else {
    activityBoard.insertAdjacentElement("afterbegin", tabbar);
  }

  const tabNodeMap = new Map(tabs.map((tab) => [tab.key, tab.nodes.filter(Boolean)]));
  const allNodes = tabs.flatMap((tab) => tab.nodes).filter(Boolean);
  const activate = (key) => {
    tabbar.querySelectorAll("[data-board-tab]").forEach((button) => {
      const selected = button.dataset.boardTab === key;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
    activityQuickActions.forEach((button) => {
      const selected = button.dataset.quickBoardTab === key;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    allNodes.forEach((node) => {
      const visible = (tabNodeMap.get(key) || []).includes(node);
      node.classList.toggle("activity-tab-hidden", !visible);
      node.hidden = !visible;
    });
    if (activityPrimaryGrid) {
      const hasVisiblePrimary = [memberFocusPanel, raffleStagePanel].some((node) => node && !node.hidden);
      activityPrimaryGrid.classList.toggle("activity-tab-hidden", !hasVisiblePrimary);
      activityPrimaryGrid.hidden = !hasVisiblePrimary;
    }
    void loadActivityBoardTab(key);
  };

  tabbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-tab]");
    if (!button) {
      return;
    }
    activate(button.dataset.boardTab);
  });
  tabbar.addEventListener("keydown", (event) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }
    const buttons = [...tabbar.querySelectorAll("[data-board-tab]")];
    const currentIndex = Math.max(0, buttons.findIndex((button) => button.getAttribute("aria-selected") === "true"));
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    }
    event.preventDefault();
    buttons[nextIndex]?.focus();
    activate(buttons[nextIndex]?.dataset.boardTab || "overview");
  });
  activityQuickActions.forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const key = button.dataset.quickBoardTab || "overview";
      activate(key);
      tabbar.querySelector(`[data-board-tab="${key}"]`)?.focus({ preventScroll: true });
    });
  });
  boardRaffleReplayButton?.addEventListener("click", () => replayBoardRaffleResult());
  activate("overview");
}

async function loadActivityBoardTab(key) {
  if (!activityBoardRuntime || activityBoardTabLoads.has(key)) {
    return;
  }
  activityBoardTabLoads.add(key);

  try {
    if (key === "rewards") {
      await loadRewardTabContent();
      return;
    }

    if (key === "challenges") {
      await loadChallenges();
      return;
    }

    if (key === "suggestions") {
      await loadSuggestionBoard();
    }
  } catch (error) {
    activityBoardTabLoads.delete(key);
    if (activityLock) {
      activityLock.textContent = `선택한 탭을 불러오지 못했습니다: ${String(error?.message || error)}`;
    }
  }
}

async function loadRewardTabContent() {
  const state = activityBoardRuntime;
  if (!state) {
    return;
  }
  const [publicPointAwards, annualPointAwards] = await Promise.all([
    loadPublicPointAwardRanking(state.selectedMonth, "month"),
    loadPublicPointAwardRanking(state.selectedMonth, "year")
  ]);
  const activeMemberNameKeys = new Set(
    state.rows
      .filter((member) => member?.is_active !== false && member?.isActive !== false)
      .map((member) => normalizeName(member.name))
      .filter(Boolean)
  );
  const activePublicPointAwards = publicPointAwards.filter((entry) => activeMemberNameKeys.has(normalizeName(entry.member_name)));
  const activeAnnualPointAwards = annualPointAwards.filter((entry) => activeMemberNameKeys.has(normalizeName(entry.member_name)));
  renderPointRankingBoard(pointRankingBoard, mergePointRankingRows(state.rows, activePublicPointAwards), state.selectedMonth, "월간");
  renderPointRankingBoard(pointRankingYearBoard, activeAnnualPointAwards, state.selectedMonth, "연간");
  await renderMyActivityDetailState(state.me, state.selectedMonth, state.raffleRecords, state.attendanceLogs);
  await loadRewardRequests();
  await loadPointAwards();
}

function buildRaffleReplayPanel() {
  const wrapper = document.createElement("section");
  wrapper.className = "activity-raffle-tab activity-tab-hidden";
  wrapper.hidden = true;
  wrapper.innerHTML = `
    <article class="panel board-highlight member-raffle-replay-panel">
      <div class="section-head">
        <h3>추첨 결과 확인</h3>
        <span class="badge">룰렛 재생</span>
      </div>
      <p id="board-raffle-replay-status" class="list-meta">운영진이 추첨을 완료하면 결과를 룰렛처럼 확인할 수 있습니다.</p>
      <div class="roulette-shell member-roulette-shell">
        <div id="board-raffle-roulette-track" class="roulette-track">READY</div>
      </div>
      <button id="board-raffle-replay-button" class="btn primary" type="button">최근 추첨 결과 확인</button>
    </article>
    <article class="panel" style="margin-top:1rem;">
      <div class="section-head">
        <h3>월별 추첨 기록</h3>
        <span class="badge">공개 기록</span>
      </div>
      <ul id="board-raffle-history-tab" class="list small" style="margin-top:0.8rem;"></ul>
    </article>
  `;
  boardRaffleReplayStatus = wrapper.querySelector("#board-raffle-replay-status");
  boardRaffleReplayButton = wrapper.querySelector("#board-raffle-replay-button");
  boardRaffleRouletteTrack = wrapper.querySelector("#board-raffle-roulette-track");
  return wrapper;
}

async function hydrateAuthState(forcedUser = undefined) {
  if (!supabaseClient) {
    return;
  }

  if (forcedUser === undefined) {
    const sessionResult = await supabaseClient.auth.getSession();
    authUser = sessionResult.data?.session?.user || null;
  } else {
    authUser = forcedUser;
  }

  await ensurePendingProfile();
  await loadMyProfile();
  renderAuthState();
  publishAuthState();
  await loadActivityBoard();
}

async function handleSignup(event) {
  event?.preventDefault();

  const payload = {
    email: String(signupEmailInput?.value || "").trim(),
    password: String(signupPasswordInput?.value || "").trim(),
    passwordConfirm: String(signupPasswordConfirmInput?.value || "").trim(),
    name: String(signupNameInput?.value || "").trim(),
    birthYear: Number(signupBirthYearInput?.value || 0),
    intro: String(signupIntroInput?.value || "").trim(),
    agreed: Boolean(signupAgreeInput?.checked)
  };

  if (!payload.email || !payload.password || !payload.name || !payload.birthYear) {
    setStatus(signupStatus, "이메일, 비밀번호, 이름, 출생연도는 필수입니다.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    setStatus(signupStatus, "이메일 형식을 확인해 주세요.");
    return;
  }
  if (payload.password.length < 6) {
    setStatus(signupStatus, "비밀번호는 6자 이상으로 입력해 주세요.");
    return;
  }
  if (payload.password !== payload.passwordConfirm) {
    setStatus(signupStatus, "비밀번호 확인이 일치하지 않습니다.");
    return;
  }
  if (payload.name.length < 2) {
    setStatus(signupStatus, "이름은 실명 기준 2자 이상으로 입력해 주세요.");
    return;
  }
  if (payload.birthYear < BIRTH_YEAR_MIN || payload.birthYear > BIRTH_YEAR_MAX) {
    setStatus(signupStatus, `출생연도는 ${BIRTH_YEAR_MIN}~${BIRTH_YEAR_MAX}만 가능합니다.`);
    return;
  }
  if (payload.intro.length < 10) {
    setStatus(signupStatus, "자기소개는 러닝 경험이나 가입 이유를 10자 이상 적어 주세요.");
    return;
  }
  if (!payload.agreed) {
    setStatus(signupStatus, "개인정보 수집 동의가 필요합니다.");
    return;
  }

  const pendingKey = `${PENDING_SIGNUP_PREFIX}${payload.email.toLowerCase()}`;
  localStorage.setItem(pendingKey, JSON.stringify({
    user_id: null,
    email: payload.email,
    name: payload.name,
    birth_year: payload.birthYear,
    intro: payload.intro,
    role: "member",
    approval_status: "pending"
  }));

  if (signupSubmitButton) {
    signupSubmitButton.disabled = true;
    signupSubmitButton.textContent = "가입 신청 중...";
  }
  setStatus(signupStatus, "가입 신청을 처리하는 중입니다...");

  try {
    const signUpResult = await supabaseClient.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login.html`,
        data: {
          name: payload.name,
          birth_year: payload.birthYear,
          intro: payload.intro,
          role: "member",
          approval_status: "pending"
        }
      }
    });
    if (signUpResult.error) {
      localStorage.removeItem(pendingKey);
      setStatus(signupStatus, `가입 실패: ${formatAuthError(signUpResult.error)}`);
      return;
    }

    const createdUserId = String(signUpResult.data?.user?.id || "").trim();
    const accessToken = String(signUpResult.data?.session?.access_token || "").trim();
    if (createdUserId && accessToken) {
      const profileResponse = await fetch("/.netlify/functions/create-pending-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name,
          birth_year: payload.birthYear,
          intro: payload.intro
        })
      });
      const profileResult = await profileResponse.json().catch(() => ({ ok: false, error: "unknown" }));
      if (!profileResponse.ok || !profileResult.ok) {
        throw new Error(profileResult.error || "pending profile creation failed");
      }
      localStorage.removeItem(pendingKey);
      await notifySignupRequest({
        email: payload.email,
        name: payload.name,
        birthYear: payload.birthYear,
        intro: payload.intro
      });
    }

    const confirmHint = accessToken
      ? "운영진 승인 후 활동 보드와 챌린지를 이용할 수 있습니다."
      : "이메일 인증 후 로그인하면 승인 대기 상태로 연결됩니다.";
    setStatus(signupStatus, `가입 신청이 완료되었습니다. ${confirmHint}`);
  } catch (error) {
    setStatus(signupStatus, `가입 처리 중 오류가 발생했습니다: ${formatAuthError(error)}. 잠시 후 다시 시도하거나 운영진에게 문의해 주세요.`);
  } finally {
    if (signupSubmitButton) {
      signupSubmitButton.disabled = false;
      signupSubmitButton.textContent = "가입 신청";
    }
  }
}

async function handleLogin(event) {
  event?.preventDefault();

  const email = String(loginEmailInput?.value || "").trim();
  const password = String(loginPasswordInput?.value || "").trim();

  if (!email || !password) {
    setStatus(loginStatus, "이메일과 비밀번호를 입력해 주세요.");
    return;
  }

  if (loginSubmitButton) {
    loginSubmitButton.disabled = true;
  }
  setStatus(loginStatus, "로그인 중...");

  try {
    const loginResult = await signInWithFallback(email, password);
    if (loginResult.error) {
      setStatus(loginStatus, `로그인 실패: ${formatAuthError(loginResult.error)}`);
      return;
    }

    const signedInUser = loginResult.data?.session?.user || loginResult.data?.user || null;
    await hydrateAuthState(signedInUser);

    if (!authUser) {
      setStatus(loginStatus, "로그인은 되었지만 세션 확인에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setStatus(loginStatus, `로그인됨: ${authUser.email}`);
  } catch (error) {
    setStatus(loginStatus, `로그인 실패: ${formatAuthError(error)}`);
  } finally {
    if (loginSubmitButton) {
      loginSubmitButton.disabled = false;
    }
  }
}

async function signInWithFallback(email, password) {
  try {
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    if (result?.error && isFetchFailure(result.error) && window.location.protocol !== "file:") {
      return signInViaNetlifyFunction(email, password);
    }
    return result;
  } catch (error) {
    if (!isFetchFailure(error) || window.location.protocol === "file:") {
      throw error;
    }
    return signInViaNetlifyFunction(email, password);
  }
}

async function signInViaNetlifyFunction(email, password) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  const response = await fetch("/.netlify/functions/auth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: controller.signal
  }).finally(() => window.clearTimeout(timeoutId));
  const result = await response.json().catch(() => ({ ok: false, error: "invalid auth response" }));
  if (!response.ok || !result?.ok) {
    const message = result?.error || `login failed (${response.status})`;
    if (response.status >= 500 || isFetchFailure(message)) {
      throw new Error(message);
    }
    return { error: { message } };
  }
  const accessToken = result?.session?.access_token;
  const refreshToken = result?.session?.refresh_token;
  if (!accessToken || !refreshToken) {
    return { error: { message: "login session missing" } };
  }
  const sessionResult = await supabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (sessionResult.error) {
    return { error: sessionResult.error };
  }
  return {
    data: {
      session: sessionResult.data?.session || result.session,
      user: sessionResult.data?.user || result.user
    }
  };
}

function isFetchFailure(error) {
  return /failed to fetch|network|fetch/i.test(String(error?.message || error || ""));
}

function formatAuthError(error) {
  const message = String(error?.message || error || "").trim();
  const lower = message.toLowerCase();
  if (!message) {
    return "알 수 없는 오류입니다.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) {
    return "이미 가입된 이메일입니다. 로그인하거나 운영진에게 승인 상태를 확인해 주세요.";
  }
  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (lower.includes("email not confirmed") || lower.includes("confirm")) {
    return "이메일 인증이 아직 완료되지 않았습니다. 받은 메일함을 확인해 주세요.";
  }
  if (lower.includes("password")) {
    return "비밀번호 조건을 확인해 주세요. 최소 6자 이상으로 입력해야 합니다.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (isFetchFailure(error)) {
    return formatAuthNetworkError(error);
  }
  return message;
}

async function handleLogout() {
  if (!supabaseClient) {
    return;
  }
  await supabaseClient.auth.signOut();
  authUser = null;
  authProfile = null;
  if (loginPasswordInput) {
    loginPasswordInput.value = "";
  }
  renderAuthState();
  publishAuthState();
  renderBoardLocked("승인 회원 로그인 후 월별 출석, 연속 출석, 이달의 러너를 볼 수 있습니다.");
  setStatus(loginStatus, loginStatus ? "로그아웃 완료" : null);
}

async function ensurePendingProfile() {
  if (!authUser?.email) {
    return;
  }

  const key = `${PENDING_SIGNUP_PREFIX}${String(authUser.email).toLowerCase()}`;
  const raw = localStorage.getItem(key);
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (_error) {
      payload = null;
    }
  }

  if (!payload) {
    const meta = authUser.user_metadata || {};
    if (meta.name && meta.birth_year) {
      payload = {
        user_id: authUser.id,
        email: authUser.email,
        name: meta.name,
        birth_year: Number(meta.birth_year || 0),
        intro: String(meta.intro || "").trim(),
        role: meta.role || "member",
        approval_status: meta.approval_status || "pending"
      };
    }
  }

  if (!payload) {
    return;
  }

  payload.user_id = authUser.id;
  payload.email = authUser.email;

  try {
    const existingProfileResult = await supabaseClient
      .from("member_profiles")
      .select("user_id,email,name,birth_year,intro,approval_status,role")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (existingProfileResult.error) {
      throw existingProfileResult.error;
    }

    const existingProfile = existingProfileResult.data || null;
    const hasExistingProfile = Boolean(existingProfile?.user_id);
    const profilePayload = hasExistingProfile
      ? buildSafeProfilePatch(existingProfile, payload)
      : payload;

    if (hasExistingProfile && !profilePayload) {
      localStorage.removeItem(key);
      return;
    }

    const profileInsert = await supabaseClient
      .from("member_profiles")
      .upsert(profilePayload, { onConflict: "user_id" });

    if (!profileInsert.error) {
      localStorage.removeItem(key);
      if (!hasExistingProfile) {
        await notifySignupRequest({
          email: profilePayload.email,
          name: profilePayload.name,
          birthYear: profilePayload.birth_year,
          intro: profilePayload.intro
        });
      }
    }
  } catch (_error) {
    // Keep pending payload for the next login attempt.
  }
}

function buildSafeProfilePatch(existingProfile, pendingPayload) {
  if (!existingProfile || !pendingPayload) {
    return null;
  }

  const nextName = String(existingProfile.name || "").trim() || String(pendingPayload.name || "").trim();
  const nextBirthYear = Number(existingProfile.birth_year || 0) || Number(pendingPayload.birth_year || 0);
  const nextIntro = String(existingProfile.intro || "").trim() || String(pendingPayload.intro || "").trim();
  const nextEmail = String(existingProfile.email || "").trim() || String(pendingPayload.email || "").trim();

  const needsPatch = (
    nextEmail !== String(existingProfile.email || "").trim()
    || nextName !== String(existingProfile.name || "").trim()
    || nextBirthYear !== Number(existingProfile.birth_year || 0)
    || nextIntro !== String(existingProfile.intro || "").trim()
  );

  if (!needsPatch) {
    return null;
  }

  return {
    user_id: existingProfile.user_id,
    email: nextEmail,
    name: nextName,
    birth_year: nextBirthYear,
    intro: nextIntro,
    role: existingProfile.role || "member",
    approval_status: existingProfile.approval_status || "pending"
  };
}

async function loadMyProfile() {
  authProfile = null;
  if (!supabaseClient || !authUser) {
    return;
  }

  const profileResult = await supabaseClient
    .from("member_profiles")
    .select("user_id,email,name,birth_year,intro,approval_status,role")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!profileResult.error) {
    authProfile = profileResult.data;
  }
}

function renderAuthState() {
  const isAdmin = Boolean(authProfile && authProfile.role === "admin" && authProfile.approval_status === "approved");
  const isApproved = Boolean(authProfile && authProfile.approval_status === "approved");

  if (!authUser) {
    updateLoginLayout(false);
    updateSharedNavigation(false, false);
    setStatus(loginStatus, loginStatus ? "로그인이 필요합니다." : null);
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 로그인 필요" : null);
    return;
  }

  if (redirectAfterLoginIfNeeded()) {
    return;
  }

  updateLoginLayout(true);
  updateSharedNavigation(Boolean(authUser), isAdmin);
  const roleSuffix = isAdmin ? " / 운영진 권한 있음" : "";
  setStatus(loginStatus, loginStatus ? `로그인됨: ${authUser.email}` : null);

  if (!isEmailConfirmed(authUser)) {
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 이메일 인증 필요(받은 메일함을 확인해 주세요)" : null);
    return;
  }

  if (!authProfile) {
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 프로필 미등록. 운영진에게 가입 상태 점검을 요청해 주세요." : null);
    return;
  }

  const label = `승인 상태: ${statusLabel(authProfile.approval_status)}${roleSuffix}`;
  setStatus(loginApprovalStatus, loginApprovalStatus ? label : null);
}

function isEmailConfirmed(user) {
  if (!user?.email) {
    return false;
  }
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function setVisibility(node, visible) {
  if (!node) {
    return;
  }
  node.classList.toggle("hidden", !visible);
  node.hidden = !visible;
}

function updateSharedNavigation(memberVisible, adminVisible) {
  memberNavLinks.forEach((node) => setVisibility(node, memberVisible));
  adminNavLinks.forEach((node) => setVisibility(node, adminVisible));
  authEntryLinks.forEach((node) => setVisibility(node, !memberVisible));
}

function updateLoginLayout(isLoggedIn) {
  setVisibility(loginForm, !isLoggedIn);
  setVisibility(loginGuestActions, !isLoggedIn);
  setVisibility(loginMemberActions, isLoggedIn);
  if (loginPanelTitle) {
    loginPanelTitle.textContent = isLoggedIn ? "내 활동 허브" : "로그인";
  }
  if (loginPanelCopy) {
    loginPanelCopy.textContent = isLoggedIn
      ? "아래 활동 보드에서 내 기록, 포인트, 리워드, 챌린지를 확인할 수 있습니다."
      : "로그인 후 활동 보드, 추첨 현황, 챌린지를 사용할 수 있습니다.";
  }
  if (loginPanel) {
    loginPanel.classList.toggle("login-panel-success", isLoggedIn);
  }
  if (authShell) {
    authShell.classList.toggle("auth-shell-logged-in", isLoggedIn);
  }
}

async function loadActivityBoard() {
  if (!supabaseClient || !activityBoard || !activityLock) {
    return;
  }
  const selectedMonth = activityMonthSelect?.value || currentMonthKey();
  if (attendanceReportDateInput && !attendanceReportDateInput.value) {
    attendanceReportDateInput.value = `${selectedMonth}-01`;
  }
  if (runnerMonthLabel) {
    runnerMonthLabel.textContent = `${monthKeyToLabel(selectedMonth)} 기준`;
  }

  if (!authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderBoardLocked("승인 회원 로그인 후 월별 출석, 연속 출석, 이달의 러너를 볼 수 있습니다.");
    return;
  }
  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} 활동 보드를 불러오는 중입니다.`;

  const isAdmin = authProfile.role === "admin" && authProfile.approval_status === "approved";
  let members = [];
  let boardSourceLabel = "운영진이 동기화한 Supabase 데이터";
  let activityData = null;

  if (isAdmin) {
    const localMembers = loadLocalAdminMembers(authUser.id);
    if (localMembers.length) {
      members = localMembers;
      boardSourceLabel = "이 브라우저의 최근 운영진 관리 데이터";
    }
  }

  if (!members.length) {
    activityData = await loadMemberActivityData().catch((error) => {
      if (activityLock) {
        activityLock.textContent = `활동 데이터 연결을 다시 확인하는 중입니다: ${String(error?.message || error)}`;
      }
      return null;
    });
    members = Array.isArray(activityData?.members) ? activityData.members : [];
    boardSourceLabel = "승인 회원 활동 데이터";
  }
  if (!members.length) {
    members = [buildProfileFallbackMember(selectedMonth)];
    boardSourceLabel = "회원 프로필과 포인트 기능 데이터";
  }

  if (!activityData) {
    activityData = await loadMemberActivityData().catch(() => null);
  }

  const raffleRecords = Array.isArray(activityData?.raffle_history) ? activityData.raffle_history : [];
  latestRaffleRecords = raffleRecords;
  const attendanceLogs = Array.isArray(activityData?.attendance_logs) ? activityData.attendance_logs : [];
  const pointSummaryByName = new Map();
  let rows = members
    .filter((member) => member?.is_active !== false && member?.isActive !== false)
    .map((member) => buildActivityRowFromMember(member, selectedMonth, pointSummaryByName, attendanceLogs))
    .sort((a, b) => compareActivityRowsForMonthlyBoard(a, b, selectedMonth));
  const profileBirthYear = Number(authProfile.birth_year || 0);
  let me = rows.find((member) => {
    const sameName = normalizeName(member.name) === normalizeName(authProfile.name);
    if (!sameName) {
      return false;
    }
    const memberBirthYear = Number(member.birth_year || 0);
    if (profileBirthYear && memberBirthYear) {
      return profileBirthYear === memberBirthYear;
    }
    return true;
  }) || null;
  if (!me) {
    me = buildActivityRowFromMember(buildProfileFallbackMember(selectedMonth), selectedMonth, pointSummaryByName, attendanceLogs);
    rows = [me, ...rows];
  }
  window.__RRC_ACTIVITY_ROWS = rows;
  activityBoardRuntime = { rows, me, selectedMonth, raffleRecords, attendanceLogs };
  activityBoardTabLoads = new Set(["overview", "raffle"]);
  const runner = getMonthlyRunner(rows);

  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} 출석 기준입니다. ${boardSourceLabel}를 바탕으로 표시됩니다.`;
  activityBoard.classList.remove("hidden");
  setVisibility(memberFeatureGuide, false);

  if (myMonthRuns) {
    myMonthRuns.textContent = `${me?.monthRuns || 0}회`;
  }
  if (myTotalRuns) {
    myTotalRuns.textContent = `${Number(me?.total_runs || 0)}회`;
  }
  if (myStreak) {
    myStreak.textContent = `${me?.streak || 0}개월`;
  }

  renderAttendanceBoard(rows, selectedMonth);
  renderPublicTicketBoard(rows, selectedMonth);
  renderCandidatePreviewBoard(rows, selectedMonth);
  renderBadgeShowcase(rows, selectedMonth);
  renderRunnerCard(runner, selectedMonth);
  renderBoardPulseSummary(rows, runner, selectedMonth);
  renderBoardRaffleHistory(raffleRecords.slice(0, 4));
  renderBoardRaffleReplayState(raffleRecords);
  renderMyActivityOverviewState(me, selectedMonth, raffleRecords, attendanceLogs);
  renderDeferredActivityTabs();
  const activeTabKey = activityBoard.querySelector(".activity-board-tab.is-active")?.dataset?.boardTab || "overview";
  if (!activityBoardTabLoads.has(activeTabKey)) {
    void loadActivityBoardTab(activeTabKey);
  }
}

function renderBoardLocked(message) {
  if (activityLock) {
    activityLock.textContent = message;
  }
  if (activityBoard) {
    activityBoard.classList.add("hidden");
  }
  setVisibility(memberFeatureGuide, true);
  renderPersonalBoardEmpty();
  renderSuggestionBoardLocked("승인 회원 로그인 후 건의사항을 남길 수 있습니다.");
  renderRewardRequestLocked("승인 회원 로그인 후 활동 혜택 신청을 할 수 있습니다.");
  renderChallengeLocked("승인 회원 로그인 후 포인트 챌린지를 볼 수 있습니다.");
  renderPublicTicketBoard([], currentMonthKey());
  renderCandidatePreviewBoard([], currentMonthKey());
  renderBadgeShowcase([], currentMonthKey());
  renderPointRankingBoard(pointRankingBoard, [], currentMonthKey(), "월간");
  renderPointRankingBoard(pointRankingYearBoard, [], currentMonthKey(), "연간");
  renderBoardRaffleReplayState([]);
}

function buildProfileFallbackMember(monthKey = currentMonthKey()) {
  return {
    id: authProfile?.user_id || authUser?.id || "me",
    user_id: authProfile?.user_id || authUser?.id || null,
    name: authProfile?.name || authUser?.email || "내 기록",
    birth_year: Number(authProfile?.birth_year || 0),
    total_runs: 0,
    monthly_runs: { [monthKey]: 0 },
    fee_status: {},
    isFallback: true
  };
}

function buildActivityRowFromMember(member, selectedMonth, pointSummaryByName, attendanceLogs) {
  const attendanceBonus = calculateAttendanceBonus(member, selectedMonth, attendanceLogs);
  const basePoints = attendanceBonus.total;
  const pointSummary = pointSummaryByName.get(normalizeName(member.name)) || {};
  const awardPoints = Number(pointSummary.points || 0);
  return {
    ...member,
    monthRuns: getMonthlyRuns(member, selectedMonth),
    regularRuns: countRegularRunsForMember(member, selectedMonth, attendanceLogs),
    streak: getAttendanceStreakFromMonth(member, selectedMonth),
    tickets: calculateMonthlyTickets(member, selectedMonth),
    basePoints,
    attendanceBonusPoints: attendanceBonus.total,
    attendanceBonusLabels: attendanceBonus.labels,
    monthlyRunnerPoints: 0,
    awardPoints,
    manualPoints: Number(pointSummary.award_points || 0),
    pointTotal: basePoints + awardPoints
  };
}

function renderAttendanceBoard(rows, monthKey) {
  if (!attendanceBoard) {
    return;
  }
  attendanceBoard.innerHTML = "";
  if (!rows.length) {
    attendanceBoard.innerHTML = '<li class="list-item"><p class="list-meta">기록된 회원 데이터가 없습니다.</p></li>';
    return;
  }

  rows.forEach((member, index) => {
    const item = document.createElement("li");
    item.className = "list-item board-ranking-item";
    const streakRunTotal = getStreakQualifiedRunTotal(member, monthKey);
    const badge = index === 0 && member.monthRuns > 0
      ? '<span class="status-chip">선두</span>'
      : member.monthRuns >= getMonthThreshold(monthKey)
        ? '<span class="status-chip">추첨 대상</span>'
        : "";
    const ticketChip = member.tickets > 0 ? `<span class="status-chip warn">추첨권 ${member.tickets}장</span>` : "";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${index + 1}. ${escapeHtml(member.name || "이름없음")}${badge}${ticketChip}</span>
        <span class="list-meta">${monthKeyToLabel(monthKey)} ${member.monthRuns}회</span>
      </div>
      <p class="list-meta">연속 누적 ${streakRunTotal}회 / 연속 출석 ${member.streak}개월 / 활동 포인트 ${getMemberPointTotal(member)}P</p>
    `;
    attendanceBoard.appendChild(item);
  });
}

function renderBoardPulseSummary(rows, runner, monthKey) {
  const threshold = getMonthThreshold(monthKey);
  const eligibleCount = rows.filter((member) => member.monthRuns >= threshold).length;
  const pointLeader = [...rows]
    .filter((member) => getMemberPointTotal(member) > 0 || member.monthRuns > 0)
    .sort((a, b) => (getMemberPointTotal(b) - getMemberPointTotal(a)) || (b.monthRuns - a.monthRuns))[0] || null;
  if (boardCandidateCount) {
    boardCandidateCount.textContent = `${eligibleCount}명`;
  }
  if (boardCandidateNote) {
    boardCandidateNote.textContent = `${monthKeyToLabel(monthKey)} 추첨 기준 ${threshold}회 이상 출석 회원입니다.`;
  }
  if (boardTopRunner) {
    boardTopRunner.textContent = runner && runner.monthRuns > 0 ? `${runner.name}` : "아직 없음";
  }
  if (boardTopRunnerNote) {
    boardTopRunnerNote.textContent = runner && runner.monthRuns > 0
      ? `정기런 ${Number(runner.regularRuns || 0)}회 · 전체 출석 ${runner.monthRuns}회`
      : `${monthKeyToLabel(monthKey)} 출석 기록이 아직 없습니다.`;
  }
  if (boardPointLeader) {
    boardPointLeader.textContent = pointLeader ? `${pointLeader.name}` : "집계 중";
  }
  if (boardPointLeaderNote) {
    boardPointLeaderNote.textContent = pointLeader
      ? `활동 포인트 ${getMemberPointTotal(pointLeader)}P · 연속 출석 ${pointLeader.streak}개월`
      : "포인트 집계 대상이 아직 없습니다.";
  }
}

function renderRunnerCard(runner, monthKey) {
  if (!runnerCard) {
    return;
  }
  if (!runner || Number(runner.regularRuns || 0) === 0) {
    runnerCard.innerHTML = `<p class="list-meta">${monthKeyToLabel(monthKey)}에는 아직 정기런 출석 기록이 없습니다.</p>`;
    return;
  }

  runnerCard.innerHTML = `
    <p class="list-meta">${monthKeyToLabel(monthKey)} 정기런 최다 출석</p>
    <h3 style="margin:0.2rem 0 0.4rem;">${escapeHtml(runner.name || "이름없음")}</h3>
    <p>정기런 ${Number(runner.regularRuns || 0)}회 / 전체 출석 ${runner.monthRuns}회</p>
    <p class="list-meta">운영진 선정 참고용 · 연속 출석 ${runner.streak}개월 · 추첨권 ${runner.tickets || calculateMonthlyTickets(runner, monthKey)}장</p>
  `;
}

function renderPublicTicketBoard(rows, monthKey) {
  if (!publicTicketBoard) {
    return;
  }
  publicTicketBoard.innerHTML = "";
  if (!rows.length) {
    publicTicketBoard.innerHTML = '<li class="list-item"><p class="list-meta">출석 추첨권 현황 준비 중입니다.</p></li>';
    return;
  }

  const visibleRows = [...rows]
    .filter((member) => member.monthRuns > 0 || member.tickets > 0 || getMemberPointTotal(member) > 0)
    .sort((a, b) => compareActivityRowsForMonthlyBoard(a, b, monthKey))
    .slice(0, 6);

  visibleRows.forEach((member, index) => {
    const item = document.createElement("li");
    item.className = "list-item board-ranking-item";
    const titleChip = index === 0
      ? '<span class="status-chip">1위</span>'
      : member.monthRuns >= getMonthThreshold(monthKey)
        ? '<span class="status-chip warn">추첨 후보</span>'
        : "";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${index + 1}. ${escapeHtml(member.name || "이름없음")}${titleChip}</span>
        <span class="list-meta">추첨권 ${member.tickets}장</span>
      </div>
      <p class="list-meta">이번 달 출석 ${member.monthRuns}회 / 연속 누적 ${getStreakQualifiedRunTotal(member, monthKey)}회 / 활동 포인트 ${getMemberPointTotal(member)}P / 연속 출석 ${member.streak}개월</p>
    `;
    publicTicketBoard.appendChild(item);
  });
}

function compareActivityRowsForMonthlyBoard(a, b, monthKey) {
  return (Number(b?.monthRuns || 0) - Number(a?.monthRuns || 0))
    || (getStreakQualifiedRunTotal(b, monthKey) - getStreakQualifiedRunTotal(a, monthKey))
    || (Number(b?.total_runs || 0) - Number(a?.total_runs || 0))
    || String(a?.name || "").localeCompare(String(b?.name || ""), "ko");
}

function getStreakQualifiedRunTotal(member, startMonthKey) {
  if (!member || !startMonthKey) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < 24; i += 1) {
    const key = shiftMonthKey(startMonthKey, -i);
    if (compareMonthKey(key, ATTENDANCE_STREAK_START_MONTH) < 0) {
      break;
    }
    const runs = getMonthlyRuns(member, key);
    if (runs <= 0) {
      break;
    }
    total += runs;
  }
  return total;
}

function renderCandidatePreviewBoard(rows, monthKey) {
  if (!candidatePreviewBoard) {
    return;
  }
  candidatePreviewBoard.innerHTML = "";
  candidatePreviewBoard.classList.remove("is-armed");
  if (raffleStageHype) {
    raffleStageHype.innerHTML = "<span>후보 집계 중</span><strong>READY</strong><span>룰렛 준비 중</span>";
  }

  const threshold = getMonthThreshold(monthKey);
  const candidates = rows
    .filter((member) => member.monthRuns >= threshold)
    .sort((a, b) => (b.tickets - a.tickets) || (b.monthRuns - a.monthRuns) || (getMemberPointTotal(b) - getMemberPointTotal(a)))
    .slice(0, 8);

  if (!candidates.length) {
    const nearly = rows
      .filter((member) => member.monthRuns > 0)
      .sort((a, b) => b.monthRuns - a.monthRuns)
      .slice(0, 4);
    candidatePreviewBoard.innerHTML = nearly.length
      ? nearly.map((member, index) => {
        const remaining = Math.max(0, threshold - Number(member.monthRuns || 0));
        return `<div class="raffle-candidate-card is-waiting" style="--candidate-delay:${index * 0.12}s"><span class="raffle-candidate-index">대기</span><strong>${escapeHtml(member.name || "이름없음")}</strong><p class="list-meta">출석 ${member.monthRuns}회 · ${remaining}회 남음</p></div>`;
      }).join("")
      : '<div class="raffle-candidate-card"><strong>후보 없음</strong><p class="list-meta">이번 달 추첨 기준을 아직 넘은 회원이 없습니다.</p></div>';
    if (raffleStageHype) {
      raffleStageHype.innerHTML = nearly.length
        ? `<span>후보 근접 ${nearly.length}명</span><strong>${threshold}회 기준</strong><span>대기 중</span>`
        : `<span>아직 조용함</span><strong>${threshold}회 기준</strong><span>첫 후보 대기</span>`;
    }
    return;
  }

  candidatePreviewBoard.classList.add("is-armed");
  if (raffleStageHype) {
    raffleStageHype.innerHTML = `<span>후보 ${candidates.length}명 입장</span><strong>SPIN READY</strong><span>추첨 전 대기</span>`;
  }

  candidates.forEach((member, index) => {
    const card = document.createElement("div");
    card.className = `raffle-candidate-card is-live${index === 0 ? " is-winner" : ""}`;
    card.style.setProperty("--candidate-delay", `${index * 0.11}s`);
    card.innerHTML = `
      <span class="raffle-candidate-index">#${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(member.name || "이름없음")}</strong>
      <p class="list-meta">룰렛 대기 · 출석 ${member.monthRuns}회 · 추첨권 ${member.tickets}장</p>
      <p class="list-meta">연속 출석 ${member.streak}개월 · 활동 포인트 ${getMemberPointTotal(member)}P</p>
    `;
    candidatePreviewBoard.appendChild(card);
  });
}

function renderBadgeShowcase(rows, monthKey) {
  if (!badgeShowcaseBoard) {
    return;
  }
  badgeShowcaseBoard.innerHTML = "";
  if (!rows.length) {
    badgeShowcaseBoard.innerHTML = '<li class="list-item"><p class="list-meta">공개 배지 준비 중입니다.</p></li>';
    return;
  }

  const showcase = [];
  const topRunner = getMonthlyRunner(rows);
  if (topRunner) {
    showcase.push({
      label: "이달의 러너",
      owner: topRunner.name,
      body: `${monthKeyToLabel(monthKey)} 정기런 ${Number(topRunner.regularRuns || 0)}회 / 운영진 선정 참고`
    });
  }
  const streakRunner = rows.find((member) => member.streak >= 6) || rows.find((member) => member.streak >= 3);
  if (streakRunner) {
    showcase.push({
      label: streakRunner.streak >= 6 ? "6개월 연속 출석" : "3개월 연속 출석",
      owner: streakRunner.name,
      body: `연속 출석 ${streakRunner.streak}개월 달성`
    });
  }
  const pointRunner = [...rows].sort((a, b) => (getMemberPointTotal(b) - getMemberPointTotal(a)))[0];
  if (pointRunner && getMemberPointTotal(pointRunner) > 0) {
    showcase.push({
      label: "포인트 러너",
      owner: pointRunner.name,
      body: `이번 달 활동 포인트 ${getMemberPointTotal(pointRunner)}P`
    });
  }

  if (!showcase.length) {
    badgeShowcaseBoard.innerHTML = '<li class="list-item"><p class="list-meta">이번 달 공개 배지 후보가 아직 없습니다.</p></li>';
    return;
  }

  showcase.forEach((badge) => {
    const item = document.createElement("li");
    item.className = "list-item board-badge-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(badge.label)}</span>
        <span class="status-chip">${escapeHtml(badge.owner)}</span>
      </div>
      <p class="list-meta">${escapeHtml(badge.body)}</p>
    `;
    badgeShowcaseBoard.appendChild(item);
  });
}

function renderPointRankingBoard(targetBoard, rows, monthKey, scopeLabel = "월간") {
  if (!targetBoard) {
    return;
  }
  targetBoard.innerHTML = "";
  const ranking = (Array.isArray(rows) ? rows : [])
    .filter((member) => getMemberPointTotal(member) > 0 || member.monthRuns > 0)
    .sort((a, b) => (getMemberPointTotal(b) - getMemberPointTotal(a)) || (b.monthRuns - a.monthRuns) || String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .slice(0, 10);

  if (!ranking.length) {
    targetBoard.innerHTML = `<li class="list-item"><p class="list-meta">아직 ${escapeHtml(scopeLabel)} 포인트 랭킹 데이터가 없습니다.</p></li>`;
    return;
  }

  ranking.forEach((member, index) => {
    const item = document.createElement("li");
    item.className = "list-item board-ranking-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${index + 1}. ${escapeHtml(member.name || member.member_name || "이름없음")}${index === 0 ? '<span class="status-chip">포인트 선두</span>' : ""}</span>
        <span class="status-chip">${getMemberPointTotal(member)}P</span>
      </div>
      <p class="list-meta">${buildPointRankingMeta(member, monthKey, scopeLabel)}</p>
    `;
    targetBoard.appendChild(item);
  });
}

function mergePointRankingRows(activityRows, pointRows) {
  const merged = [...(Array.isArray(activityRows) ? activityRows : [])];
  const seen = new Set(merged.map((row) => normalizeName(row.name || row.member_name || "")));
  (Array.isArray(pointRows) ? pointRows : []).forEach((row) => {
    const key = normalizeName(row.member_name || row.name || "");
    if (key && !seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  });
  return merged;
}

function buildPointRankingMeta(member, monthKey, scopeLabel = "월간") {
  if (member.member_name && !member.name) {
    const parts = [`${scopeLabel} 합계 ${Number(member.points || 0).toLocaleString("ko-KR")}P`];
    if (Number(member.award_points || 0)) {
      parts.push(`지급 ${Number(member.award_points || 0).toLocaleString("ko-KR")}P`);
    }
    return parts.join(" · ");
  }
  const parts = [
    `${monthKeyToLabel(monthKey)} 정기런 ${Number(member.regularRuns || 0)}회`,
    `전체 출석 ${Number(member.monthRuns || 0)}회`
  ];
  if (Array.isArray(member.attendanceBonusLabels) && member.attendanceBonusLabels.length) {
    parts.push(member.attendanceBonusLabels.join(" + "));
  } else if (Number(member.attendanceBonusPoints || 0)) {
    parts.push(`정기런 배지 ${Number(member.attendanceBonusPoints || 0)}P`);
  }
  if (Number(member.monthlyRunnerPoints || 0)) {
    parts.push(`이달의 러너 ${Number(member.monthlyRunnerPoints || 0)}P`);
  }
  if (Number(member.manualPoints || 0)) {
    parts.push(`가입/운영/챌린지 ${Number(member.manualPoints || 0)}P`);
  }
  return parts.join(" · ");
}

function renderBoardRaffleHistory(records) {
  if (!boardRaffleHistory) {
    return;
  }
  boardRaffleHistory.innerHTML = "";
  if (!records.length) {
    boardRaffleHistory.innerHTML = '<li class="list-item"><p class="list-meta">추첨 기록이 없습니다.</p></li>';
    return;
  }

  records.forEach((record) => {
    const winners = Array.isArray(record.winners) ? record.winners.map((winner) => winner.name).join(", ") : "";
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${monthKeyToLabel(record.target_month_key)} 추첨</span>
        <span class="list-meta">${formatDate(record.created_at)}</span>
      </div>
      <p class="list-meta">기준 ${record.threshold}회 / ${record.winner_count}명 추첨</p>
      <p>${escapeHtml(winners || "당첨자 없음")}</p>
    `;
    boardRaffleHistory.appendChild(item);
  });
}

function renderBoardRaffleReplayState(records) {
  const historyTab = document.getElementById("board-raffle-history-tab");
  const source = Array.isArray(records) ? records : [];
  if (boardRaffleReplayStatus) {
    const latest = source[0] || null;
    boardRaffleReplayStatus.textContent = latest
      ? `${monthKeyToLabel(latest.target_month_key)} 운영진 추첨 결과를 룰렛처럼 다시 확인할 수 있습니다.`
      : "운영진이 추첨을 완료하면 결과를 룰렛처럼 확인할 수 있습니다.";
  }
  if (boardRaffleReplayButton) {
    boardRaffleReplayButton.disabled = !source.length;
  }
  if (boardRaffleRouletteTrack && !source.length) {
    boardRaffleRouletteTrack.textContent = "READY";
  }
  if (!historyTab) {
    return;
  }
  historyTab.innerHTML = "";
  if (!source.length) {
    historyTab.innerHTML = '<li class="list-item"><p class="list-meta">추첨 기록이 없습니다.</p></li>';
    return;
  }
  source.forEach((record, index) => {
    const winners = Array.isArray(record.winners) ? record.winners.map((winner) => winner.name).join(", ") : "";
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${monthKeyToLabel(record.target_month_key)} 추첨</span>
        <span class="list-meta">${formatDate(record.created_at)}</span>
      </div>
      <p class="list-meta">기준 ${record.threshold}회 / ${record.winner_count}명 추첨</p>
      <p>${escapeHtml(winners || "당첨자 없음")}</p>
      <div class="item-actions">
        <button class="btn tiny" type="button" data-replay-raffle="${index}">결과 확인</button>
      </div>
    `;
    item.querySelector("[data-replay-raffle]")?.addEventListener("click", () => replayBoardRaffleResult(record));
    historyTab.appendChild(item);
  });
}

function replayBoardRaffleResult(record = null) {
  const target = record || latestRaffleRecords[0] || null;
  if (!target || !boardRaffleRouletteTrack) {
    if (boardRaffleReplayStatus) {
      boardRaffleReplayStatus.textContent = "아직 재생할 추첨 기록이 없습니다.";
    }
    return;
  }

  const winners = Array.isArray(target.winners) ? target.winners : [];
  const rows = Array.isArray(window.__RRC_ACTIVITY_ROWS) ? window.__RRC_ACTIVITY_ROWS : [];
  const candidates = rows
    .filter((member) => getMonthlyRuns(member, target.target_month_key) >= Number(target.threshold || 0))
    .map((member) => ({
      name: member.name,
      runs: getMonthlyRuns(member, target.target_month_key)
    }));
  const spinPool = candidates.length ? candidates : winners;

  if (!spinPool.length) {
    boardRaffleRouletteTrack.textContent = "NO WINNER";
    if (boardRaffleReplayStatus) {
      boardRaffleReplayStatus.textContent = `${monthKeyToLabel(target.target_month_key)} 당첨자가 없습니다.`;
    }
    return;
  }

  let tick = 0;
  boardRaffleRouletteTrack.textContent = monthKeyToLabel(target.target_month_key);
  boardRaffleRouletteTrack.classList.add("spinning");
  if (boardRaffleReplayStatus) {
    boardRaffleReplayStatus.textContent = `${monthKeyToLabel(target.target_month_key)} 추첨 결과를 재생하는 중입니다...`;
  }

  const timer = setInterval(() => {
    const member = spinPool[tick % spinPool.length];
    boardRaffleRouletteTrack.textContent = `${member.name} · ${Number(member.runs || 0)}회`;
    tick += 1;
  }, 85);

  setTimeout(() => {
    clearInterval(timer);
    boardRaffleRouletteTrack.classList.remove("spinning");
    const names = winners.length
      ? winners.map((winner) => `${winner.name} (${Number(winner.runs || 0)}회)`).join(" / ")
      : "당첨자 없음";
    boardRaffleRouletteTrack.textContent = names;
    if (boardRaffleReplayStatus) {
      boardRaffleReplayStatus.textContent = `${monthKeyToLabel(target.target_month_key)} 추첨 결과: ${names}`;
    }
  }, 2600);
}

function populateRecentMonthOptions(selectNode) {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    const label = i === 0 ? `${monthKeyToLabel(key)} 현재 월` : `${monthKeyToLabel(key)} 기록`;
    options.push(`<option value="${key}">${label}</option>`);
  }
  selectNode.innerHTML = options.join("");
  selectNode.value = currentMonthKey();
}

function getAttendanceStreak(member) {
  return getAttendanceStreakFromMonth(member, currentMonthKey());
}

function getMonthlyRuns(member, monthKey) {
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object"
    ? member.monthly_runs
    : member?.monthlyRuns && typeof member.monthlyRuns === "object"
      ? member.monthlyRuns
      : {};
  return Number(monthlyRuns[monthKey] || 0);
}

async function loadMemberActivityData() {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return { members: [], attendance_logs: [], raffle_history: [] };
  }
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }
  const response = await fetch(`/.netlify/functions/member-activity?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = await response.json().catch(() => ({ ok: false, error: "invalid response" }));
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `activity request failed (${response.status})`);
  }
  return result;
}

async function loadAttendanceLogsForPoints() {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  try {
    const result = await loadMemberActivityData();
    return Array.isArray(result?.attendance_logs) ? result.attendance_logs : [];
  } catch (_error) {
    return [];
  }
}

function renderMyActivityOverviewState(me, selectedMonth, raffleRecords, attendanceLogs = []) {
  const wins = Array.isArray(raffleRecords)
    ? raffleRecords.filter((record) => hasRaffleWinner(record, authProfile?.name))
    : [];
  const latestWin = wins[0] || null;
  const previousStreak = getAttendanceStreakFromMonth(me, shiftMonthKey(selectedMonth, -1));
  const currentStreak = getAttendanceStreakFromMonth(me, selectedMonth);
  const raffleThreshold = getMonthThreshold(selectedMonth);
  const ticketCount = calculateMonthlyTickets(me, selectedMonth);
  const pointTotal = getMemberPointTotal(me);
  const raffleLabel = latestWin
    ? `${monthKeyToLabel(latestWin.target_month_key)} 당첨`
    : (me?.monthRuns || 0) >= raffleThreshold
      ? `${monthKeyToLabel(selectedMonth)} 후보 · 추첨권 ${ticketCount}장`
      : `${Math.max(raffleThreshold - Number(me?.monthRuns || 0), 0)}회 남음`;

  if (myRaffleStatus) {
    myRaffleStatus.textContent = raffleLabel;
  }
  if (myStreakChange) {
    myStreakChange.textContent = formatStreakDelta(currentStreak, previousStreak);
  }
  if (myTicketCount) {
    myTicketCount.textContent = `${ticketCount}장`;
  }
  if (myPointTotal) {
    myPointTotal.textContent = `${Number(pointTotal || 0).toLocaleString("ko-KR")}P`;
  }
  if (myNextReward) {
    myNextReward.textContent = "혜택 탭에서 확인";
  }
  if (myPointNote) {
    myPointNote.textContent = "요약은 먼저 표시하고, 포인트 랭킹과 활동 혜택은 포인트 탭에서 불러옵니다.";
  }
  renderBadgeList(buildPersonalBadges({
    me,
    selectedMonth,
    latestWin,
    pointTotal,
    ticketCount,
    attendanceLogs,
    pointAwards: [],
    photoCount: 0,
    commentCount: 0
  }));
  renderMyAttendanceHistory(me, selectedMonth, attendanceLogs);
  renderSimpleHistory(myRaffleHistory, wins.map((record) => ({
    title: `${monthKeyToLabel(record.target_month_key)} 추첨`,
    meta: formatDate(record.created_at),
    body: `${record.threshold}회 기준 / ${record.winner_count}명 추첨`
  })), "아직 당첨 이력이 없습니다.");
}

function renderDeferredActivityTabs() {
  renderSimpleHistory(myPointAwardHistory, [], "포인트 탭을 열면 포인트 지급 기록을 불러옵니다.");
  if (pointRankingBoard) {
    pointRankingBoard.innerHTML = '<li class="list-item"><p class="list-meta">포인트 탭을 열면 랭킹을 불러옵니다.</p></li>';
  }
  if (pointRankingYearBoard) {
    pointRankingYearBoard.innerHTML = '<li class="list-item"><p class="list-meta">포인트 탭을 열면 연간 랭킹을 불러옵니다.</p></li>';
  }
  renderRewardRequestLocked("포인트 탭을 열면 활동 혜택 신청 내역을 불러옵니다.");
  renderChallengeLocked("챌린지 탭을 열면 모집 중인 챌린지를 불러옵니다.");
  if (suggestionList) {
    suggestionList.innerHTML = '<li class="list-item"><p class="list-meta">건의함 탭을 열면 의견 목록을 불러옵니다.</p></li>';
  }
}

async function renderMyActivityDetailState(me, selectedMonth, raffleRecords, attendanceLogs = []) {
  const [pointAwards, allPointAwards, rewardRequests] = await Promise.all([
    loadPointAwardsForMonth(selectedMonth),
    loadPointAwardsForAllMonths(),
    loadRewardRequestsForBalance()
  ]);
  const wins = Array.isArray(raffleRecords)
    ? raffleRecords.filter((record) => hasRaffleWinner(record, authProfile?.name))
    : [];
  const latestWin = wins[0] || null;
  const previousStreak = getAttendanceStreakFromMonth(me, shiftMonthKey(selectedMonth, -1));
  const currentStreak = getAttendanceStreakFromMonth(me, selectedMonth);
  const raffleThreshold = getMonthThreshold(selectedMonth);
  const ticketCount = calculateMonthlyTickets(me, selectedMonth);
  const pointTotal = calculatePersonalMonthlyPoints({
    me,
    selectedMonth,
    photoCount: 0,
    commentCount: 0,
    attendanceLogs,
    pointAwards
  });
  const pointBreakdown = calculatePersonalMonthlyPointBreakdown({
    me,
    photoCount: 0,
    commentCount: 0,
    pointAwards
  });
  const rewardBalance = calculateRewardBalance({
    selectedMonth,
    monthlyPointTotal: pointTotal,
    pointAwards,
    allPointAwards,
    rewardRequests,
    attendanceLogs
  });
  const raffleLabel = latestWin
    ? `${monthKeyToLabel(latestWin.target_month_key)} 당첨`
    : (me?.monthRuns || 0) >= raffleThreshold
      ? `${monthKeyToLabel(selectedMonth)} 후보 · 추첨권 ${ticketCount}장`
      : "대기 중";
  const nextReward = getNextReward(rewardBalance.availablePoints);

  if (myRaffleStatus) {
    myRaffleStatus.textContent = raffleLabel;
  }
  if (myStreakChange) {
    myStreakChange.textContent = formatStreakDelta(currentStreak, previousStreak);
  }
  if (myTicketCount) {
    myTicketCount.textContent = `${ticketCount}장`;
  }
  if (myPointTotal) {
    myPointTotal.textContent = `${pointTotal}P`;
  }
  if (myNextReward) {
    myNextReward.textContent = nextReward.label;
  }
  if (myPointNote) {
    const breakdownText = formatPointBreakdown(pointBreakdown);
    myPointNote.textContent = nextReward.remaining > 0
      ? `${breakdownText} · ${nextReward.remaining}P 더 모으면 ${nextReward.label} 신청권에 가까워집니다.`
      : `${breakdownText} · ${nextReward.label} 구간입니다. 현재 기준 약 ${Number(nextReward.won || 0).toLocaleString("ko-KR")}원 상당입니다.`;
  }
  renderRewardLoungeState(rewardBalance);

  renderBadgeList(buildPersonalBadges({
    me,
    selectedMonth,
    latestWin,
    pointTotal,
    ticketCount,
    attendanceLogs,
    pointAwards,
    photoCount: 0,
    commentCount: 0
  }));
  renderMyAttendanceHistory(me, selectedMonth, attendanceLogs);
  renderSimpleHistory(
    myRaffleHistory,
    wins.map((record) => ({
      title: `${monthKeyToLabel(record.target_month_key)} 추첨`,
      meta: formatDate(record.created_at),
      body: `${record.threshold}회 기준 / ${record.winner_count}명 추첨`
    })),
    "아직 당첨 이력이 없습니다."
  );

  renderSimpleHistory(
    myPointAwardHistory,
    pointAwards.map((award) => ({
      title: `${award.award_label || "포인트 지급"} · ${Number(award.points || 0)}P`,
      meta: monthKeyToLabel(award.month_key || selectedMonth),
      body: award.note || award.member_name || ""
    })),
    "아직 포인트 지급 기록이 없습니다."
  );
}

function renderPersonalBoardEmpty() {
  activityBoardRuntime = null;
  activityBoardTabLoads = new Set();
  if (myRaffleStatus) {
    myRaffleStatus.textContent = "확인 중";
  }
  if (myStreakChange) {
    myStreakChange.textContent = "확인 중";
  }
  if (myTicketCount) {
    myTicketCount.textContent = "0장";
  }
  if (myPointTotal) {
    myPointTotal.textContent = "0P";
  }
  if (myNextReward) {
    myNextReward.textContent = "준비 중";
  }
  if (myPointNote) {
    myPointNote.textContent = "정기런 배지, 챌린지, 운영 리워드로 포인트를 모아 활동 혜택 신청에 활용할 수 있습니다.";
  }
  renderBadgeList([]);
  renderSimpleHistory(myRaffleHistory, [], "로그인 후 내 추첨 기록이 표시됩니다.");
  renderSimpleHistory(myPointAwardHistory, [], "로그인 후 포인트 지급 기록이 표시됩니다.");
  renderMyAttendanceHistory(null, currentMonthKey(), []);
  renderRewardLoungeState({ earnedPoints: 0, usedPoints: 0, pendingPoints: 0, availablePoints: 0 });
}

function renderMyAttendanceHistory(me, selectedMonth, attendanceLogs = []) {
  if (!myAttendanceHistory) {
    return;
  }
  const logs = getMemberAttendanceLogs(me, attendanceLogs)
    .filter((log) => toMonthKey(log.attendance_date || log.date || "") === selectedMonth)
    .sort((a, b) => String(a.attendance_date || a.date || "").localeCompare(String(b.attendance_date || b.date || "")));

  if (myAttendanceNote) {
    myAttendanceNote.textContent = `${monthKeyToLabel(selectedMonth)} 기준 ${logs.length}건이 출석 로그에 반영되어 있습니다. 누락이 있으면 아래 신고를 남겨 주세요.`;
  }
  if (!logs.length) {
    myAttendanceHistory.innerHTML = '<li class="list-item"><p class="list-meta">선택한 월에 반영된 내 출석 로그가 없습니다.</p></li>';
    return;
  }

  myAttendanceHistory.innerHTML = "";
  logs.forEach((log) => {
    const date = String(log.attendance_date || log.date || "");
    const eventType = String(log.event_type || log.eventType || "출석");
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(formatDate(date))} ${escapeHtml(eventType)}</span>
        <span class="status-chip">반영됨</span>
      </div>
      <p class="list-meta">${escapeHtml(getAttendanceVenueLabel(date, eventType))}</p>
    `;
    myAttendanceHistory.appendChild(item);
  });
}

function getAttendanceVenueLabel(dateValue, eventType = "") {
  const date = parseIsoDateOnly(dateValue);
  const weekday = date ? date.getDay() : null;
  if (String(eventType).includes("정기")) {
    if (weekday === 2) {
      return "화요일 한강 정기런";
    }
    if (weekday === 4) {
      return "목요일 올림픽공원 정기런";
    }
    return "정기런";
  }
  return eventType || "출석";
}

async function handleAttendanceReportSubmit(event) {
  event?.preventDefault();
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(attendanceReportStatus, "승인 회원 로그인 후 출석 누락 신고를 남길 수 있습니다.");
    return;
  }

  const date = String(attendanceReportDateInput?.value || "").trim();
  const eventType = String(attendanceReportTypeInput?.value || "정기런").trim();
  const note = String(attendanceReportNoteInput?.value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !note) {
    setStatus(attendanceReportStatus, "누락된 날짜와 내용을 함께 입력해 주세요.");
    return;
  }

  const title = `[출석 누락] ${date} ${eventType}`;
  const content = [
    `신고자: ${authProfile.name || authUser.email || "회원"}`,
    `출석일: ${date}`,
    `유형: ${eventType}`,
    `내용: ${note}`
  ].join("\n");

  if (attendanceReportSubmitButton) {
    attendanceReportSubmitButton.disabled = true;
  }
  setStatus(attendanceReportStatus, "출석 누락 신고를 등록하는 중입니다...");
  try {
    const result = await callMemberSuggestions("", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        is_anonymous: false
      })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "attendance report failed");
    }
    if (attendanceReportNoteInput) {
      attendanceReportNoteInput.value = "";
    }
    setStatus(attendanceReportStatus, "출석 누락 신고를 등록했습니다. 운영진이 확인 후 처리합니다.");
    await loadSuggestionBoard();
  } catch (error) {
    setStatus(attendanceReportStatus, `출석 누락 신고 실패: ${String(error?.message || error)}`);
  } finally {
    if (attendanceReportSubmitButton) {
      attendanceReportSubmitButton.disabled = false;
    }
  }
}

function calculateRewardBalance({ monthlyPointTotal, pointAwards, allPointAwards, rewardRequests, attendanceLogs }) {
  const selectedAwardPoints = sumPointAwardRows(pointAwards);
  const selectedMonthFallback = Math.max(Number(monthlyPointTotal || 0), selectedAwardPoints);
  const earnedFromAwards = sumPointAwardRows(allPointAwards);
  const earnedFromSignupBonus = hasSignupBonusAward(allPointAwards) ? 0 : POINT_POLICY.signupBonus;
  const earnedFromAttendanceBonuses = calculateAttendanceBonusRewardPoints(attendanceLogs);
  const earnedPoints = Math.max(
    earnedFromAwards + earnedFromSignupBonus + earnedFromAttendanceBonuses,
    selectedMonthFallback
  );
  const usedPoints = sumRewardRequestCosts(rewardRequests, ["fulfilled"]);
  const pendingPoints = sumRewardRequestCosts(rewardRequests, ["submitted", "approved"]);
  return {
    earnedPoints,
    usedPoints,
    pendingPoints,
    availablePoints: Math.max(earnedPoints - usedPoints - pendingPoints, 0)
  };
}

function sumPointAwardRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row.points || 0), 0);
}

function hasSignupBonusAward(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => row.award_code === "signup_bonus");
}

function sumRewardRequestCosts(rows, statuses) {
  const statusSet = new Set(statuses);
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => statusSet.has(String(row.status || "")))
    .reduce((sum, row) => sum + Number(row.point_cost || 0), 0);
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

function calculateAttendanceBonusRewardPoints(attendanceLogs = []) {
  const targetName = normalizeName(authProfile?.name || "");
  if (!targetName) {
    return 0;
  }
  const candidateMember = {
    name: authProfile?.name || "",
    monthly_runs: buildMonthlyRunsFromAttendanceLogs(targetName, attendanceLogs)
  };
  const months = new Set(
    (Array.isArray(attendanceLogs) ? attendanceLogs : [])
      .map((log) => toMonthKey(log.attendance_date || log.date || ""))
      .filter((monthKey) => monthKey && compareMonthKey(monthKey, ATTENDANCE_STREAK_START_MONTH) >= 0)
  );
  let total = 0;
  months.forEach((monthKey) => {
    total += calculateAttendanceBonus(candidateMember, monthKey, attendanceLogs).total;
  });
  return total;
}

function buildMonthlyRunsFromAttendanceLogs(targetName, attendanceLogs = []) {
  const monthlyRuns = {};
  (Array.isArray(attendanceLogs) ? attendanceLogs : []).forEach((log) => {
    const matched = Array.isArray(log?.matched) ? log.matched : [];
    if (!matched.some((name) => normalizeName(name) === targetName)) {
      return;
    }
    const monthKey = toMonthKey(log.attendance_date || log.date || "");
    if (monthKey) {
      monthlyRuns[monthKey] = Number(monthlyRuns[monthKey] || 0) + 1;
    }
  });
  return monthlyRuns;
}

function renderRewardLoungeState({ earnedPoints = 0, usedPoints = 0, pendingPoints = 0, availablePoints = 0 }) {
  rewardBalanceSnapshot = {
    earnedPoints: Number(earnedPoints || 0),
    usedPoints: Number(usedPoints || 0),
    pendingPoints: Number(pendingPoints || 0)
  };
  rewardAvailableBeforeChallengeLockCache = Number(availablePoints || 0);
  if (rewardBalanceTotal) {
    rewardBalanceTotal.textContent = `${Number(earnedPoints || 0).toLocaleString("ko-KR")}P`;
  }
  if (rewardBalanceUsed) {
    rewardBalanceUsed.textContent = `${Number(usedPoints || 0).toLocaleString("ko-KR")}P`;
  }
  syncRewardAvailabilityDisplay();
}

function syncRewardAvailabilityDisplay() {
  const pendingPoints = Number(rewardBalanceSnapshot.pendingPoints || 0);
  const lockedPoints = Number(challengeLockedPointCache || 0);
  rewardAvailablePointCache = Math.max(Number(rewardAvailableBeforeChallengeLockCache || 0) - lockedPoints, 0);
  if (rewardBalanceAvailable) {
    rewardBalanceAvailable.textContent = `${rewardAvailablePointCache.toLocaleString("ko-KR")}P`;
  }
  if (rewardBalanceNote) {
    const pendingText = pendingPoints > 0
      ? ` 신청/승인 대기 ${pendingPoints.toLocaleString("ko-KR")}P는 미리 제외했습니다.`
      : "";
    const lockedText = lockedPoints > 0
      ? ` 챌린지 예치 ${lockedPoints.toLocaleString("ko-KR")}P는 정산 전까지 잠김 처리됩니다.`
      : "";
    rewardBalanceNote.textContent = `누적 적립에서 사용 완료·대기 중인 보조 신청을 제외한 기준입니다.${pendingText}${lockedText}`;
  }
  renderRewardTierCards(rewardAvailablePointCache);
}

function renderRewardTierCards(availablePoints) {
  if (!rewardPreviewList) {
    return;
  }
  const currentPoints = Number(availablePoints || 0);
  rewardPreviewList.innerHTML = REWARD_ITEMS.map((item) => {
    const missing = Math.max(Number(item.points || 0) - currentPoints, 0);
    const ratio = Number(item.points || 0) > 0 ? Math.min(Math.round((currentPoints / Number(item.points || 0)) * 100), 100) : 0;
    const status = missing > 0 ? `${missing.toLocaleString("ko-KR")}P 더 필요` : "신청 가능";
    return `
      <div class="reward-preview-card">
        <div class="list-top">
          <strong>${Number(item.points || 0).toLocaleString("ko-KR")}P</strong>
          <span class="status-chip">${escapeHtml(status)}</span>
        </div>
        <p class="list-meta">${escapeHtml(item.name)}</p>
        <div class="reward-progress" aria-label="${escapeHtml(item.name)} 진행률">
          <span style="width:${ratio}%"></span>
        </div>
        <p class="list-meta">사용 가능 ${currentPoints.toLocaleString("ko-KR")}P / 필요 ${Number(item.points || 0).toLocaleString("ko-KR")}P</p>
      </div>
    `;
  }).join("");
}

async function handleSuggestionSubmit(event) {
  event?.preventDefault();
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(suggestionStatus, "승인 회원 로그인 후 건의사항을 등록할 수 있습니다.");
    return;
  }

  const title = String(suggestionTitleInput?.value || "").trim();
  const content = String(suggestionContentInput?.value || "").trim();
  const isAnonymous = Boolean(suggestionAnonymousInput?.checked);
  if (!title || !content) {
    setStatus(suggestionStatus, "제목과 내용을 모두 입력해 주세요.");
    return;
  }

  suggestionSubmitButton && (suggestionSubmitButton.disabled = true);
  setStatus(suggestionStatus, "건의사항을 등록하는 중입니다...");

  try {
    const result = await callMemberSuggestions("", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        is_anonymous: isAnonymous
      })
    });

    if (!result?.ok) {
      throw new Error(result?.error || "suggestion submit failed");
    }

    if (suggestionTitleInput) {
      suggestionTitleInput.value = "";
    }
    if (suggestionContentInput) {
      suggestionContentInput.value = "";
    }
    if (suggestionAnonymousInput) {
      suggestionAnonymousInput.checked = false;
    }
    setStatus(suggestionStatus, "건의사항이 등록되었습니다. 운영진 검토 상태를 아래에서 확인할 수 있습니다.");
    await loadSuggestionBoard();
  } catch (error) {
    setStatus(suggestionStatus, `건의 등록 실패: ${String(error?.message || error)}`);
  } finally {
    suggestionSubmitButton && (suggestionSubmitButton.disabled = false);
  }
}

async function loadSuggestionBoard() {
  if (!suggestionList) {
    return;
  }
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderSuggestionBoardLocked("승인 회원 로그인 후 건의사항과 처리 상태를 볼 수 있습니다.");
    return;
  }

  suggestionRefreshButton && (suggestionRefreshButton.disabled = true);
  if (!suggestionList.innerHTML) {
    suggestionList.innerHTML = '<li class="list-item"><p class="list-meta">건의함을 불러오는 중입니다.</p></li>';
  }

  try {
    const result = await callMemberSuggestions("?limit=12");
    const items = Array.isArray(result?.items) ? result.items : [];
    if (result?.available === false) {
      renderSuggestionBoardLocked("건의함 테이블 준비 중입니다. Supabase 패치를 먼저 적용해 주세요.");
      return;
    }
    renderSuggestionList(items, Boolean(result?.can_manage));
    setStatus(suggestionStatus, "회원 건의사항과 운영 상태를 확인할 수 있습니다.");
  } catch (error) {
    renderSuggestionBoardLocked(`건의함 로드 실패: ${String(error?.message || error)}`);
  } finally {
    suggestionRefreshButton && (suggestionRefreshButton.disabled = false);
  }
}

async function handleRewardRequestSubmit(event) {
  event?.preventDefault();
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(rewardRequestStatus, "승인 회원 로그인 후 활동 혜택 신청을 할 수 있습니다.");
    return;
  }

  const itemCode = String(rewardRequestItem?.value || "").trim();
  const note = String(rewardRequestNote?.value || "").trim();
  const rewardInfo = getRewardItemMeta(itemCode);
  if (!rewardInfo) {
    setStatus(rewardRequestStatus, "신청할 보조 항목을 선택해 주세요.");
    return;
  }
  if (rewardAvailablePointCache < Number(rewardInfo.points || 0)) {
    setStatus(rewardRequestStatus, `${rewardInfo.name} 신청까지 ${Number(rewardInfo.points || 0) - rewardAvailablePointCache}P 더 필요합니다.`);
    return;
  }

  rewardRequestSubmitButton && (rewardRequestSubmitButton.disabled = true);
  setStatus(rewardRequestStatus, "활동 혜택 신청을 등록하는 중입니다...");
  try {
    const result = await callMemberRewards("", {
      method: "POST",
      body: JSON.stringify({
        reward_code: rewardInfo.code,
        reward_name: rewardInfo.name,
        point_cost: rewardInfo.points,
        note
      })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "reward request failed");
    }
    if (rewardRequestNote) {
      rewardRequestNote.value = "";
    }
    setStatus(rewardRequestStatus, "활동 혜택 신청이 접수되었습니다. 운영진 승인 후 진행됩니다.");
    await loadRewardRequests();
    await refreshRewardBalanceOverview();
  } catch (error) {
    setStatus(rewardRequestStatus, `보조 신청 실패: ${String(error?.message || error)}`);
  } finally {
    rewardRequestSubmitButton && (rewardRequestSubmitButton.disabled = false);
  }
}

async function loadRewardRequests() {
  if (!rewardRequestList) {
    return;
  }
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderRewardRequestLocked("승인 회원 로그인 후 활동 혜택 신청을 할 수 있습니다.");
    return;
  }

  rewardRequestRefreshButton && (rewardRequestRefreshButton.disabled = true);
  if (!rewardRequestList.innerHTML) {
    rewardRequestList.innerHTML = '<li class="list-item"><p class="list-meta">신청 내역을 불러오는 중입니다.</p></li>';
  }

  try {
    const result = await callMemberRewards("?limit=10");
    const items = Array.isArray(result?.items) ? result.items : [];
    if (result?.available === false) {
      renderRewardRequestLocked("reward_requests 테이블 준비 중입니다. Supabase 패치를 먼저 적용해 주세요.");
      return;
    }
    renderRewardRequestList(items, Boolean(result?.can_manage));
    setStatus(rewardRequestStatus, "신청 내역과 운영 상태를 확인할 수 있습니다.");
  } catch (error) {
    renderRewardRequestLocked(`신청 내역 로드 실패: ${String(error?.message || error)}`);
  } finally {
    rewardRequestRefreshButton && (rewardRequestRefreshButton.disabled = false);
  }
}

function renderRewardRequestLocked(message) {
  if (rewardRequestList) {
    rewardRequestList.innerHTML = `<li class="list-item"><p class="list-meta">${escapeHtml(message)}</p></li>`;
  }
  if (rewardRequestStatus) {
    rewardRequestStatus.textContent = message;
  }
}

function renderRewardRequestList(items, canManage) {
  if (!rewardRequestList) {
    return;
  }
  rewardRequestList.innerHTML = "";
  if (!items.length) {
    rewardRequestList.innerHTML = '<li class="list-item"><p class="list-meta">아직 활동 혜택 신청 내역이 없습니다.</p></li>';
    return;
  }

  items.forEach((item) => {
    const node = document.createElement("li");
    const statusClass = getRewardRequestStatusClass(item.status);
    node.className = "list-item";
    node.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(item.reward_name || "활동 혜택 신청")}</span>
        <span class="status-chip ${statusClass}">${escapeHtml(getRewardRequestStatusLabel(item.status))}</span>
      </div>
      <p class="list-meta">${escapeHtml(item.requester_name || "회원")} · ${escapeHtml(formatDate(item.created_at))} · ${Number(item.point_cost || 0)}P 기준</p>
      <p>${escapeHtml(item.note || "사유 없음")}</p>
    `;

    if (canManage) {
      const actions = document.createElement("div");
      actions.className = "item-actions";
      [
        { key: "approved", label: "승인" },
        { key: "fulfilled", label: "지급 완료" },
        { key: "rejected", label: "반려" }
      ].forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn ghost tiny";
        button.textContent = action.label;
        button.addEventListener("click", () => {
          void updateRewardRequestStatus(item.id, action.key, action.label);
        });
        actions.appendChild(button);
      });
      node.appendChild(actions);
    }

    rewardRequestList.appendChild(node);
  });
}

async function refreshRewardBalanceOverview() {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return;
  }
  const selectedMonth = activityMonthSelect?.value || currentMonthKey();
  const [pointAwards, allPointAwards, rewardRequests, attendanceLogs] = await Promise.all([
    loadPointAwardsForMonth(selectedMonth),
    loadPointAwardsForAllMonths(),
    loadRewardRequestsForBalance(),
    loadAttendanceLogsForPoints()
  ]);
  renderRewardLoungeState(calculateRewardBalance({
    selectedMonth,
    monthlyPointTotal: 0,
    pointAwards,
    allPointAwards,
    rewardRequests,
    attendanceLogs
  }));
}

async function updateRewardRequestStatus(requestId, status, label) {
  if (!requestId) {
    return;
  }
  try {
    const result = await callMemberRewards("", {
      method: "PATCH",
      body: JSON.stringify({ id: requestId, status })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "reward request update failed");
    }
    setStatus(rewardRequestStatus, `신청 상태를 '${label}'로 변경했습니다.`);
    await loadRewardRequests();
  } catch (error) {
    setStatus(rewardRequestStatus, `신청 상태 변경 실패: ${String(error?.message || error)}`);
  }
}

async function callMemberRewards(query = "", options = {}) {
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/.netlify/functions/member-rewards${query}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: options.body
  });
  const result = await response.json().catch(() => ({ ok: false, error: "invalid response" }));
  if (!response.ok) {
    throw new Error(result?.error || `request failed (${response.status})`);
  }
  return result;
}

function syncPointAwardDefaults() {
  if (!pointAwardCodeInput || !pointAwardPointsInput) {
    return;
  }
  const meta = getPointAwardMeta(pointAwardCodeInput.value);
  if (meta) {
    pointAwardPointsInput.value = String(meta.points);
  }
}

async function handlePointAwardSubmit(event) {
  event?.preventDefault();
  if (!supabaseClient || !authUser || !authProfile || authProfile.role !== "admin" || authProfile.approval_status !== "approved") {
    setStatus(pointAwardStatus, "운영진 로그인 후 포인트를 지급할 수 있습니다.");
    return;
  }

  const memberName = String(pointAwardMemberInput?.value || "").trim();
  const monthKey = String(pointAwardMonthInput?.value || currentMonthKey()).trim();
  const awardCode = String(pointAwardCodeInput?.value || "").trim();
  const meta = getPointAwardMeta(awardCode);
  const points = Number(pointAwardPointsInput?.value || meta?.points || 0);
  const note = String(pointAwardNoteInput?.value || "").trim();
  if (!memberName || !monthKey || !meta || points <= 0) {
    setStatus(pointAwardStatus, "회원 이름, 월, 지급 유형, 포인트를 확인해 주세요.");
    return;
  }

  pointAwardSubmitButton && (pointAwardSubmitButton.disabled = true);
  setStatus(pointAwardStatus, "포인트를 지급하는 중입니다...");
  try {
    const result = await callPointAwards("", {
      method: "POST",
      body: JSON.stringify({
        member_name: memberName,
        month_key: monthKey,
        award_code: awardCode,
        award_label: meta.label,
        points,
        note
      })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "point award failed");
    }
    if (pointAwardMemberInput) {
      pointAwardMemberInput.value = "";
    }
    if (pointAwardNoteInput) {
      pointAwardNoteInput.value = "";
    }
    setStatus(pointAwardStatus, `${memberName}님에게 ${meta.label} ${points}P를 지급했습니다.`);
    await loadPointAwards();
    await loadActivityBoard();
  } catch (error) {
    setStatus(pointAwardStatus, `포인트 지급 실패: ${String(error?.message || error)}`);
  } finally {
    pointAwardSubmitButton && (pointAwardSubmitButton.disabled = false);
  }
}

async function loadPointAwards() {
  if (!pointAwardPanel && !myPointAwardHistory) {
    return [];
  }
  const isAdmin = authProfile?.role === "admin" && authProfile?.approval_status === "approved";
  if (pointAwardPanel) {
    pointAwardPanel.classList.toggle("hidden", !isAdmin);
    pointAwardPanel.hidden = !isAdmin;
  }
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  const monthKey = pointAwardMonthInput?.value || activityMonthSelect?.value || currentMonthKey();
  try {
    const result = await callPointAwards(`?month_key=${encodeURIComponent(monthKey)}&limit=30`);
    const items = Array.isArray(result?.items) ? result.items : [];
    if (result?.available === false) {
      if (pointAwardStatus) {
        pointAwardStatus.textContent = "포인트 지급 테이블 준비 중입니다. Supabase 패치를 먼저 적용해 주세요.";
      }
      return [];
    }
    if (isAdmin) {
      renderPointAwardAdminList(items);
    }
    return items;
  } catch (error) {
    if (pointAwardStatus) {
      pointAwardStatus.textContent = `포인트 지급 내역 로드 실패: ${String(error?.message || error)}`;
    }
    return [];
  }
}

async function loadPointAwardsForMonth(monthKey) {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  try {
    const result = await callPointAwards(`?month_key=${encodeURIComponent(monthKey)}&limit=50`);
    return filterMyPointAwardRows(result?.items);
  } catch (_error) {
    return [];
  }
}

async function loadPointAwardsForAllMonths() {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  try {
    const result = await callPointAwards("?period=all&limit=500");
    return filterMyPointAwardRows(result?.items);
  } catch (_error) {
    return [];
  }
}

async function loadRewardRequestsForBalance() {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  try {
    const result = await callMemberRewards("?limit=100");
    return filterMyRewardRequestRows(result?.items);
  } catch (_error) {
    return [];
  }
}

function filterMyPointAwardRows(items) {
  const myUserId = String(authUser?.id || "");
  const myName = normalizeName(authProfile?.name || "");
  return (Array.isArray(items) ? items : []).filter((item) => {
    const rowUserId = String(item?.user_id || "");
    const rowName = normalizeName(item?.member_name || "");
    return (myUserId && rowUserId === myUserId) || (myName && rowName === myName);
  });
}

function filterMyRewardRequestRows(items) {
  const myUserId = String(authUser?.id || "");
  const myName = normalizeName(authProfile?.name || "");
  return (Array.isArray(items) ? items : []).filter((item) => {
    const rowUserId = String(item?.user_id || "");
    const rowName = normalizeName(item?.requester_name || "");
    return (myUserId && rowUserId === myUserId) || (myName && rowName === myName);
  });
}

async function loadPublicPointAwardRanking(monthKey, period = "month") {
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    return [];
  }
  try {
    const query = `?month_key=${encodeURIComponent(monthKey)}&limit=500&public=ranking&period=${encodeURIComponent(period)}`;
    const result = await callPointAwards(query);
    return Array.isArray(result?.ranking) ? result.ranking : [];
  } catch (_error) {
    return [];
  }
}

function renderPointAwardAdminList(items) {
  if (!pointAwardList) {
    return;
  }
  pointAwardList.innerHTML = "";
  if (!items.length) {
    pointAwardList.innerHTML = '<li class="list-item"><p class="list-meta">이번 달 포인트 지급 내역이 없습니다.</p></li>';
    return;
  }
  items.forEach((award) => {
    const node = document.createElement("li");
    node.className = "list-item";
    node.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(award.member_name || "회원")} · ${escapeHtml(award.award_label || "포인트")}</span>
        <span class="status-chip">${Number(award.points || 0)}P</span>
      </div>
      <p class="list-meta">${escapeHtml(monthKeyToLabel(award.month_key || currentMonthKey()))} · ${escapeHtml(award.note || "사유 없음")}</p>
    `;
    pointAwardList.appendChild(node);
  });
}

async function callPointAwards(query = "", options = {}) {
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/.netlify/functions/member-point-awards${query}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: options.body
  });
  const result = await response.json().catch(() => ({ ok: false, error: "invalid response" }));
  if (!response.ok) {
    throw new Error(result?.error || `request failed (${response.status})`);
  }
  return result;
}

function getPointAwardMeta(code) {
  return getPointAwardOptions().find((item) => item.code === code) || null;
}

function getPointAwardOptions() {
  return [
    { code: "romantic_runner", label: "낭만러너", points: 30 },
    { code: "pacemaker", label: "페이스메이커", points: 40 },
    { code: "operations_helper", label: "운영헬퍼", points: 40 },
    { code: "challenge_maker", label: "챌린지메이커", points: 30 },
    { code: "monthly_runner", label: "이달의 러너", points: 100 },
    { code: "flash_king", label: "이달의 번개왕", points: 100 },
    { code: "hiking_king", label: "등산킹", points: 300 }
  ];
}

function getChallengeModeOptions() {
  return {
    free_intro: {
      label: "무료 참여형",
      description: "포인트를 걸지 않고 가볍게 참여하는 챌린지입니다. 성공하면 보상 포인트를 받고, 실패해도 차감되지 않습니다.",
      entryPoints: 0,
      successRewardPoints: 30,
      minParticipants: 1,
      failurePolicy: "실패 패널티 없음",
      verificationMethod: "RRC 카카오톡 채팅방 인증"
    },
    deposit: {
      label: "포인트 예치형",
      description: "참여 포인트를 잠그고 목표를 달성하는 챌린지입니다. 성공하면 잠금이 풀리고 보너스 포인트를 받습니다.",
      entryPoints: 30,
      successRewardPoints: 30,
      minParticipants: 2,
      failurePolicy: "성공 시 예치 포인트 잠금 해제 + 보너스 지급, 실패 시 운영 기준에 따라 잠금 해제",
      verificationMethod: "RRC 카카오톡 채팅방 인증"
    }
  };
}

function getChallengeModeMeta(mode) {
  const options = getChallengeModeOptions();
  return options[String(mode || "")] || options.free_intro;
}

function syncChallengeModeFields() {
  const mode = challengeModeInput?.value || "free_intro";
  const meta = getChallengeModeMeta(mode);
  if (challengeModeDescription) {
    challengeModeDescription.textContent = meta.description;
  }
  if (challengeStakeInput) {
    challengeStakeInput.value = String(meta.entryPoints);
    challengeStakeInput.readOnly = true;
  }
  if (challengeSuccessRewardInput) {
    challengeSuccessRewardInput.value = String(meta.successRewardPoints);
  }
  if (challengeMinParticipantsInput) {
    challengeMinParticipantsInput.value = String(meta.minParticipants);
  }
  if (challengeVerificationMethodInput && !challengeVerificationMethodInput.value) {
    challengeVerificationMethodInput.value = meta.verificationMethod;
  }
  if (challengeFailurePolicyInput) {
    challengeFailurePolicyInput.value = meta.failurePolicy;
  }
}

async function handleChallengeSubmit(event) {
  event?.preventDefault();
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(challengeStatus, "승인 회원 로그인 후 챌린지를 제안할 수 있습니다.");
    return;
  }

  const mode = challengeModeInput?.value || "free_intro";
  const modeMeta = getChallengeModeMeta(mode);
  const title = String(challengeTitleInput?.value || "").trim();
  const stakePoints = Math.max(0, Number(challengeStakeInput?.value || modeMeta.entryPoints || 0));
  const successRewardPoints = Math.max(0, Number(challengeSuccessRewardInput?.value || modeMeta.successRewardPoints || 0));
  const minParticipants = Math.max(1, Number(challengeMinParticipantsInput?.value || modeMeta.minParticipants || 1));
  const verificationTag = String(challengeTagInput?.value || "").trim();
  const verificationMethod = String(challengeVerificationMethodInput?.value || modeMeta.verificationMethod || "").trim();
  const failurePolicy = String(challengeFailurePolicyInput?.value || modeMeta.failurePolicy || "").trim();
  const recruitStartDate = String(challengeRecruitStartInput?.value || "").trim();
  const recruitEndDate = String(challengeRecruitEndInput?.value || "").trim();
  const startDate = String(challengeStartInput?.value || "").trim();
  const endDate = String(challengeEndInput?.value || "").trim();
  const ruleText = String(challengeRuleInput?.value || "").trim();

  if (!title || !recruitStartDate || !recruitEndDate || !startDate || !endDate || !ruleText) {
    setStatus(challengeStatus, "챌린지명, 모집 기간, 진행 기간, 성공 조건을 입력해 주세요.");
    return;
  }
  if (stakePoints > rewardAvailablePointCache) {
    setStatus(challengeStatus, `현재 사용 가능 포인트는 ${rewardAvailablePointCache}P입니다. 보유 포인트보다 큰 챌린지는 제안할 수 없습니다.`);
    return;
  }
  const confirmText = [
    "이 내용으로 챌린지 모집을 시작할까요?",
    "",
    `챌린지명: ${title}`,
    `모드: ${modeMeta.label}`,
    `참가비/예치 포인트: ${stakePoints}P`,
    `성공 보상: ${successRewardPoints}P`,
    `모집 기간: ${recruitStartDate} ~ ${recruitEndDate}`,
    `진행 기간: ${startDate} ~ ${endDate}`,
    verificationTag ? `인증 태그: ${verificationTag}` : "",
    "",
    `모집 종료 후 참가자 ${minParticipants}명 이상이면 자동으로 진행됩니다.`
  ].filter(Boolean).join("\n");
  if (!confirm(confirmText)) {
    return;
  }

  challengeSubmitButton && (challengeSubmitButton.disabled = true);
  setStatus(challengeStatus, "챌린지 제안을 등록하는 중입니다...");
  try {
    const result = await callMemberChallenges("", {
      method: "POST",
      body: JSON.stringify({
        title,
        mode,
        entry_points: stakePoints,
        success_reward_points: successRewardPoints,
        min_participants: minParticipants,
        verification_method: verificationMethod,
        failure_policy: failurePolicy,
        stake_points: stakePoints,
        verification_tag: verificationTag,
        recruit_start_date: recruitStartDate,
        recruit_end_date: recruitEndDate,
        start_date: startDate,
        end_date: endDate,
        rule_text: ruleText
      })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "challenge submit failed");
    }
    challengeForm?.reset();
    syncChallengeModeFields();
    setStatus(challengeStatus, "챌린지 모집이 시작되었습니다. 모집 종료 후 3명 이상이면 자동으로 진행됩니다.");
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `챌린지 등록 실패: ${String(error?.message || error)}`);
  } finally {
    challengeSubmitButton && (challengeSubmitButton.disabled = false);
  }
}

async function loadChallenges() {
  if (!challengeList) {
    return;
  }
  if (!supabaseClient || !authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderChallengeLocked("승인 회원 로그인 후 포인트 챌린지를 볼 수 있습니다.");
    return;
  }

  challengeRefreshButton && (challengeRefreshButton.disabled = true);
  if (!challengeList.innerHTML) {
    challengeList.innerHTML = '<li class="list-item"><p class="list-meta">챌린지를 불러오는 중입니다.</p></li>';
  }

  try {
    const limit = getRequestedChallengeId() ? 50 : 12;
    const result = await callMemberChallenges(`?limit=${limit}`);
    const items = Array.isArray(result?.items) ? result.items : [];
    if (result?.available === false) {
      renderChallengeLocked("챌린지 테이블 준비 중입니다. Supabase 패치를 먼저 적용해 주세요.");
      return;
    }
    renderChallengeList(items, Boolean(result?.can_manage));
    setStatus(challengeStatus, "카톡 인증형 포인트 챌린지를 확인할 수 있습니다.");
  } catch (error) {
    renderChallengeLocked(`챌린지 로드 실패: ${String(error?.message || error)}`);
  } finally {
    challengeRefreshButton && (challengeRefreshButton.disabled = false);
  }
}

function renderChallengeLocked(message) {
  challengeLockedPointCache = 0;
  syncRewardAvailabilityDisplay();
  if (challengeList) {
    challengeList.innerHTML = `<li class="list-item"><p class="list-meta">${escapeHtml(message)}</p></li>`;
  }
  if (challengeStatus) {
    challengeStatus.textContent = message;
  }
}

function renderChallengeList(items, canManage) {
  if (!challengeList) {
    return;
  }
  challengeList.innerHTML = "";
  challengeLockedPointCache = calculateMyChallengeLockedPoints(items);
  syncRewardAvailabilityDisplay();
  if (!items.length) {
    challengeList.innerHTML = '<li class="list-item"><p class="list-meta">아직 등록된 챌린지가 없습니다.</p></li>';
    return;
  }

  items.forEach((item) => {
    const entries = Array.isArray(item.entries) ? item.entries : [];
    const joined = entries.some((entry) => entry.user_id === authUser?.id);
    const successEntries = entries.filter((entry) => entry.result === "success");
    const successCount = successEntries.length;
    const mode = item.mode || "free_intro";
    const modeMeta = getChallengeModeMeta(mode);
    const entryPoints = Number(item.entry_points ?? item.stake_points ?? modeMeta.entryPoints ?? 0);
    const successRewardPoints = Number(item.success_reward_points ?? modeMeta.successRewardPoints ?? 0);
    const minParticipants = Number(item.min_participants || modeMeta.minParticipants || 1);
    const failurePolicy = item.failure_policy || modeMeta.failurePolicy;
    const verificationMethod = item.verification_method || modeMeta.verificationMethod || "RRC 카카오톡 채팅방 인증";
    const pot = entries.reduce((sum, entry) => sum + Number(entry.locked_points ?? entry.stake_points ?? entryPoints), 0);
    const recruitStart = item.recruit_start_date || item.created_at?.slice(0, 10) || "-";
    const recruitEnd = item.recruit_end_date || item.start_date || "-";
    const progressPercent = getChallengeProgressPercent(item, entries, successCount);
    const node = document.createElement("li");
    node.className = "list-item";
    node.id = `challenge-${item.id}`;
    node.dataset.challengeId = String(item.id || "");
    node.innerHTML = `
      <div class="list-top">
        <span class="list-title"><span class="status-chip">${escapeHtml(modeMeta.label)}</span>${escapeHtml(item.title || "포인트 챌린지")}</span>
        <span class="status-chip ${getChallengeStatusClass(item.status)}">${escapeHtml(getChallengeStatusLabel(item.status))}</span>
      </div>
      <p class="list-meta">모집 ${escapeHtml(recruitStart)} ~ ${escapeHtml(recruitEnd)} · 진행 ${escapeHtml(item.start_date || "-")} ~ ${escapeHtml(item.end_date || "-")}</p>
      <p class="list-meta">${entryPoints > 0 ? `참여 시 ${entryPoints}P 잠금` : "참여 포인트 없음"} · 성공 보상 ${successRewardPoints}P · 실패 처리: ${escapeHtml(failurePolicy)}</p>
      <p class="list-meta">최소 ${minParticipants}명 · 현재 ${entries.length}명 참여 중 · 잠금 ${pot}P</p>
      <p class="list-meta">인증: ${escapeHtml(verificationMethod)} ${item.verification_tag ? `· ${escapeHtml(item.verification_tag)}` : ""}</p>
      <div class="reward-progress challenge-progress" aria-label="챌린지 진행률"><span style="width:${progressPercent}%"></span></div>
      <p>${escapeHtml(item.rule_text || "")}</p>
      <p class="list-meta">진행률 ${progressPercent}% · 성공 ${successCount}명${item.status === "settled" ? ` · 지급 완료 ${Number(item.payout_points || 0)}P` : ""}</p>
    `;

    const entryWrap = document.createElement("div");
    entryWrap.className = "challenge-entry-list";
    entries.slice(0, 8).forEach((entry) => {
      const row = document.createElement("div");
      row.className = "challenge-entry-row";
      row.innerHTML = `<span>${escapeHtml(entry.member_name || "회원")}</span><span>잠금 ${Number(entry.locked_points ?? entry.stake_points ?? 0)}P · ${escapeHtml(getChallengeResultLabel(entry.result))}${entry.payout_points ? ` · 정산 ${Number(entry.payout_points)}P` : ""}</span>`;
      entryWrap.appendChild(row);
    });
    if (entries.length) {
      node.appendChild(entryWrap);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";
    if (item.status === "recruiting" && !joined) {
      node.appendChild(buildChallengeJoinForm(item));
    }
    actions.appendChild(buildActionButton("공지 복사", () => copyChallengeNotice(item)));
    actions.appendChild(buildActionButton("링크 복사", () => copyChallengeShareLink(item)));
    if (canManage) {
      if (item.status === "submitted") {
        actions.appendChild(buildActionButton("모집 시작", () => updateChallengeStatus(item.id, "recruiting", "모집 시작")));
      }
      if (item.status === "in_progress") {
        actions.appendChild(buildActionButton("인증 확인", () => updateChallengeStatus(item.id, "judging", "인증 확인")));
      }
      if (item.status === "judging") {
        entries.forEach((entry) => {
          if (entry.result !== "success") {
            actions.appendChild(buildActionButton(`${entry.member_name} 성공`, () => judgeChallengeEntry(entry.id, "success")));
          }
          if (entry.result !== "failed") {
            actions.appendChild(buildActionButton(`${entry.member_name} 실패`, () => judgeChallengeEntry(entry.id, "failed")));
          }
        });
        actions.appendChild(buildActionButton("정산", () => settleChallenge(item.id)));
      }
      if (item.status !== "settled" && item.status !== "cancelled") {
        actions.appendChild(buildActionButton("취소", () => updateChallengeStatus(item.id, "cancelled", "취소")));
      }
      actions.appendChild(buildActionButton("삭제", () => deleteChallenge(item.id, item.title || "포인트 챌린지")));
    }
    if (actions.childElementCount) {
      node.appendChild(actions);
    }
    challengeList.appendChild(node);
  });
  focusRequestedChallenge();
}

function calculateMyChallengeLockedPoints(items) {
  const activeStatuses = new Set(["submitted", "recruiting", "in_progress", "judging"]);
  return (Array.isArray(items) ? items : []).reduce((total, item) => {
    if (!activeStatuses.has(String(item?.status || ""))) {
      return total;
    }
    const entries = Array.isArray(item.entries) ? item.entries : [];
    const entry = entries.find((candidate) => candidate.user_id === authUser?.id);
    return total + Number(entry?.locked_points ?? entry?.stake_points ?? 0);
  }, 0);
}

function buildChallengeJoinForm(item) {
  const form = document.createElement("form");
  form.className = "challenge-join-form";
  const mode = item?.mode || "free_intro";
  const modeMeta = getChallengeModeMeta(mode);
  const defaultStake = Number(item?.entry_points ?? item?.stake_points ?? modeMeta.entryPoints ?? 0);
  form.innerHTML = `
    <p class="list-meta">${defaultStake > 0 ? `참여하면 ${Number(defaultStake || 0)}P가 정산 전까지 잠깁니다.` : "포인트 차감 없이 참여합니다."}</p>
    <button class="btn primary tiny" type="submit">참가하기</button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    joinChallenge(item.id, defaultStake, defaultStake);
  });
  return form;
}

function buildActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn ghost tiny";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function copyChallengeNotice(item) {
  const recruitStart = item?.recruit_start_date || item?.created_at?.slice(0, 10) || "-";
  const recruitEnd = item?.recruit_end_date || item?.start_date || "-";
  const tag = item?.verification_tag ? `\n인증 해시태그: ${item.verification_tag}` : "";
  const shareUrl = getChallengeShareUrl(item?.id);
  const modeMeta = getChallengeModeMeta(item?.mode || "free_intro");
  const entryPoints = Number(item?.entry_points ?? item?.stake_points ?? modeMeta.entryPoints ?? 0);
  const rewardPoints = Number(item?.success_reward_points ?? modeMeta.successRewardPoints ?? 0);
  const text = [
    `[RRC ${modeMeta.label} 챌린지 모집]`,
    `챌린지명: ${item?.title || "포인트 챌린지"}`,
    `참가비/예치: ${entryPoints}P`,
    `성공 보상: ${rewardPoints}P`,
    `모집 기간: ${recruitStart} ~ ${recruitEnd}`,
    `진행 기간: ${item?.start_date || "-"} ~ ${item?.end_date || "-"}`,
    `인증: RRC 카카오톡 채팅방${tag}`,
    `성공 조건: ${item?.rule_text || "-"}`,
    `참여 링크: ${shareUrl}`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    setStatus(challengeStatus, "카톡 공지용 문구를 복사했습니다.");
  } catch (_error) {
    window.prompt("카톡방에 붙여넣을 공지 문구입니다.", text);
  }
}

async function copyChallengeShareLink(item) {
  const shareUrl = getChallengeShareUrl(item?.id);
  try {
    await navigator.clipboard.writeText(shareUrl);
    setStatus(challengeStatus, "챌린지 참여 링크를 복사했습니다.");
  } catch (_error) {
    window.prompt("카톡방에 붙여넣을 챌린지 참여 링크입니다.", shareUrl);
  }
}

function getChallengeShareUrl(challengeId) {
  const fallback = new URL(PUBLIC_LOGIN_URL);
  try {
    const current = new URL(window.location.href);
    const base = current.protocol === "file:" ? fallback : current;
    base.searchParams.set("challenge", String(challengeId || ""));
    base.hash = "challenge-list";
    return base.toString();
  } catch (_error) {
    fallback.searchParams.set("challenge", String(challengeId || ""));
    fallback.hash = "challenge-list";
    return fallback.toString();
  }
}

function getRequestedChallengeId() {
  try {
    return String(new URLSearchParams(window.location.search).get("challenge") || "").trim();
  } catch (_error) {
    return "";
  }
}

function focusRequestedChallenge() {
  const challengeId = getRequestedChallengeId();
  if (!challengeId || !challengeList) {
    return;
  }
  const target = challengeList.querySelector(`[data-challenge-id="${escapeCssIdentifier(challengeId)}"]`);
  if (!target) {
    setStatus(challengeStatus, "공유된 챌린지를 찾지 못했습니다. 목록 새로고침 후 다시 확인해 주세요.");
    return;
  }
  target.classList.add("challenge-share-target");
  setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
}

function escapeCssIdentifier(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value || ""));
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
}

async function joinChallenge(challengeId, defaultStake = 0, explicitStake = null) {
  const rawStake = explicitStake ?? defaultStake;
  if (rawStake === null) {
    return;
  }
  const stakePoints = Number(rawStake || 0);
  if (!Number.isFinite(stakePoints) || stakePoints < 0) {
    setStatus(challengeStatus, "참가 포인트를 숫자로 입력해 주세요.");
    return;
  }
  if (stakePoints > 2000) {
    setStatus(challengeStatus, "챌린지 참여 포인트는 최대 2,000P까지 입력할 수 있습니다.");
    return;
  }
  if (stakePoints > rewardAvailablePointCache) {
    setStatus(challengeStatus, `현재 사용 가능 포인트는 ${rewardAvailablePointCache}P입니다. 보유 포인트 안에서 참가해 주세요.`);
    return;
  }
  try {
    const result = await callMemberChallenges("", {
      method: "PATCH",
      body: JSON.stringify({ action: "join", challenge_id: challengeId, stake_points: stakePoints })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "join failed");
    }
    setStatus(challengeStatus, stakePoints > 0
      ? `챌린지에 참가했습니다. ${stakePoints}P가 정산 전까지 잠깁니다.`
      : "챌린지에 참가했습니다. 인증 규칙을 확인해 주세요.");
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `챌린지 참가 실패: ${String(error?.message || error)}`);
  }
}

async function updateChallengeStatus(challengeId, status, label) {
  try {
    const result = await callMemberChallenges("", {
      method: "PATCH",
      body: JSON.stringify({ action: "status", challenge_id: challengeId, status })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "status failed");
    }
    setStatus(challengeStatus, `챌린지 상태를 '${label}'로 변경했습니다.`);
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `챌린지 상태 변경 실패: ${String(error?.message || error)}`);
  }
}

async function judgeChallengeEntry(entryId, resultStatus) {
  try {
    const result = await callMemberChallenges("", {
      method: "PATCH",
      body: JSON.stringify({ action: "judge", entry_id: entryId, result: resultStatus })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "judge failed");
    }
    setStatus(challengeStatus, "참가자 판정을 저장했습니다.");
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `참가자 판정 실패: ${String(error?.message || error)}`);
  }
}

async function settleChallenge(challengeId) {
  if (!confirm("참가자 판정 기준으로 챌린지 포인트를 정산할까요?")) {
    return;
  }
  try {
    const result = await callMemberChallenges("", {
      method: "PATCH",
      body: JSON.stringify({ action: "settle", challenge_id: challengeId })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "settle failed");
    }
    setStatus(challengeStatus, `정산 완료: 성공자 ${result.success_count || 0}명 · 총 ${result.payout_total || result.payout_points || 0}P를 지급했습니다.`);
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `정산 실패: ${String(error?.message || error)}`);
  }
}

async function deleteChallenge(challengeId, title = "포인트 챌린지") {
  if (!confirm(`"${title}" 챌린지를 삭제할까요?\n\n참가 내역도 함께 삭제됩니다. 테스트/오등록 정리용으로만 사용해 주세요.`)) {
    return;
  }
  try {
    const result = await callMemberChallenges("", {
      method: "PATCH",
      body: JSON.stringify({ action: "delete", challenge_id: challengeId })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "delete failed");
    }
    setStatus(challengeStatus, "챌린지를 삭제했습니다.");
    await loadChallenges();
  } catch (error) {
    setStatus(challengeStatus, `챌린지 삭제 실패: ${String(error?.message || error)}`);
  }
}

async function callMemberChallenges(query = "", options = {}) {
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/.netlify/functions/member-challenges${query}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: options.body
  });
  const result = await response.json().catch(() => ({ ok: false, error: "invalid response" }));
  if (!response.ok) {
    throw new Error(result?.error || `request failed (${response.status})`);
  }
  return result;
}

function getChallengeStatusLabel(status) {
  switch (String(status || "")) {
    case "submitted": return "제안";
    case "recruiting": return "모집 중";
    case "in_progress": return "진행 중";
    case "judging": return "인증 확인";
    case "settled": return "정산 완료";
    case "cancelled": return "취소";
    default: return "제안";
  }
}

function getChallengeStatusClass(status) {
  switch (String(status || "")) {
    case "recruiting":
    case "in_progress":
      return "";
    case "cancelled":
      return "danger";
    default:
      return "warn";
  }
}

function getChallengeProgressPercent(item, entries, successCount) {
  const explicitTarget = Number(item?.progress_target || 0);
  const explicitCurrent = Number(item?.progress_current || 0);
  if (explicitTarget > 0) {
    return Math.max(0, Math.min(Math.round((explicitCurrent / explicitTarget) * 100), 100));
  }
  const status = String(item?.status || "");
  if (status === "settled") {
    return 100;
  }
  if (status === "cancelled") {
    return 0;
  }
  if (status === "judging") {
    const count = Array.isArray(entries) ? entries.length : 0;
    return count ? Math.min(Math.round((Number(successCount || 0) / count) * 100), 100) : 0;
  }
  const minParticipants = Number(item?.min_participants || getChallengeModeMeta(item?.mode).minParticipants || 1);
  return Math.max(0, Math.min(Math.round(((Array.isArray(entries) ? entries.length : 0) / minParticipants) * 100), 100));
}

function getChallengeResultLabel(result) {
  switch (String(result || "")) {
    case "success": return "성공";
    case "failed": return "실패";
    case "refunded": return "환불";
    default: return "참가";
  }
}

function getRewardItemMeta(code) {
  return REWARD_ITEMS.find((item) => item.code === code) || null;
}

function getRewardRequestStatusLabel(status) {
  switch (String(status || "")) {
    case "approved":
      return "승인";
    case "fulfilled":
      return "지급 완료";
    case "rejected":
      return "반려";
    default:
      return "접수";
  }
}

function getRewardRequestStatusClass(status) {
  switch (String(status || "")) {
    case "fulfilled":
      return "";
    case "approved":
      return "warn";
    case "rejected":
      return "danger";
    default:
      return "warn";
  }
}

function renderSuggestionBoardLocked(message) {
  if (suggestionList) {
    suggestionList.innerHTML = `<li class="list-item"><p class="list-meta">${escapeHtml(message)}</p></li>`;
  }
  if (suggestionStatus) {
    suggestionStatus.textContent = message;
  }
}

function renderSuggestionList(items, canManage) {
  if (!suggestionList) {
    return;
  }
  suggestionList.innerHTML = "";
  if (!items.length) {
    suggestionList.innerHTML = '<li class="list-item"><p class="list-meta">아직 등록된 건의사항이 없습니다.</p></li>';
    return;
  }

  items.forEach((item) => {
    const node = document.createElement("li");
    const statusClass = getSuggestionStatusClass(item.status);
    const authorLabel = item.user_id === authUser?.id
      ? (item.is_anonymous ? "나 · 익명 제출" : "나")
      : (item.is_anonymous ? "익명 회원" : (item.author_name || "회원"));
    node.className = "list-item suggestion-item";
    node.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(item.title || "제안")}</span>
        <span class="status-chip ${statusClass}">${escapeHtml(getSuggestionStatusLabel(item.status))}</span>
      </div>
      <p class="list-meta">${escapeHtml(authorLabel)} · ${escapeHtml(formatDate(item.created_at))}</p>
      <p>${escapeHtml(item.content || "")}</p>
    `;

    if (item.status === "planned" || item.status === "under_review") {
      node.classList.add("suggestion-item-emphasis");
    }

    if (canManage) {
      const actions = document.createElement("div");
      actions.className = "item-actions";
      [
        { key: "under_review", label: "검토 중" },
        { key: "planned", label: "반영 예정" },
        { key: "completed", label: "완료" },
        { key: "rejected", label: "반려" }
      ].forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn ghost tiny";
        button.textContent = action.label;
        button.addEventListener("click", () => {
          void updateSuggestionStatus(item.id, action.key, action.label);
        });
        actions.appendChild(button);
      });
      node.appendChild(actions);
    }

    suggestionList.appendChild(node);
  });
}

async function updateSuggestionStatus(suggestionId, status, label) {
  if (!suggestionId) {
    return;
  }
  try {
    const result = await callMemberSuggestions("", {
      method: "PATCH",
      body: JSON.stringify({ id: suggestionId, status })
    });
    if (!result?.ok) {
      throw new Error(result?.error || "suggestion update failed");
    }
    setStatus(suggestionStatus, `건의 상태를 '${label}'로 변경했습니다.`);
    await loadSuggestionBoard();
  } catch (error) {
    setStatus(suggestionStatus, `건의 상태 변경 실패: ${String(error?.message || error)}`);
  }
}

async function callMemberSuggestions(query = "", options = {}) {
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/.netlify/functions/member-suggestions${query}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: options.body
  });
  const result = await response.json().catch(() => ({ ok: false, error: "invalid response" }));
  if (!response.ok) {
    throw new Error(result?.error || `request failed (${response.status})`);
  }
  return result;
}

function getSuggestionStatusLabel(status) {
  switch (String(status || "")) {
    case "under_review":
      return "검토 중";
    case "planned":
      return "반영 예정";
    case "completed":
      return "완료";
    case "rejected":
      return "반려";
    default:
      return "접수됨";
  }
}

function getSuggestionStatusClass(status) {
  switch (String(status || "")) {
    case "completed":
      return "";
    case "planned":
      return "warn";
    case "rejected":
      return "danger";
    default:
      return "warn";
  }
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function renderSimpleHistory(node, items, emptyText) {
  if (!node) {
    return;
  }
  node.innerHTML = "";
  if (!items.length) {
    node.innerHTML = `<li class="list-item"><p class="list-meta">${escapeHtml(emptyText)}</p></li>`;
    return;
  }
  items.forEach((item) => {
    const element = document.createElement("li");
    element.className = "list-item";
    element.innerHTML = `
      <div class="list-top">
        <span class="list-title">${escapeHtml(item.title || "기록")}</span>
        <span class="list-meta">${escapeHtml(item.meta || "")}</span>
      </div>
      <p class="list-meta">${escapeHtml(item.body || "")}</p>
    `;
    node.appendChild(element);
  });
}

function renderBadgeList(badges) {
  if (!myBadges) {
    return;
  }
  myBadges.innerHTML = "";
  if (!badges.length) {
    myBadges.innerHTML = '<span class="raffle-tag">이번 달 활동 시작</span>';
    return;
  }
  badges.forEach((badge) => {
    const node = document.createElement("span");
    node.className = "raffle-tag";
    node.textContent = badge;
    myBadges.appendChild(node);
  });
}

function buildPersonalBadges({ me, selectedMonth, latestWin, photoCount, commentCount, pointTotal, ticketCount, attendanceLogs, pointAwards }) {
  const badges = [];
  const threshold = getMonthThreshold(selectedMonth);
  const attendanceBonus = getAttendanceBonusState(me, selectedMonth, attendanceLogs);
  if ((me?.monthRuns || 0) >= threshold) {
    badges.push("이번 달 추첨 대상");
  }
  if ((me?.monthRuns || 0) >= threshold + 1) {
    badges.push("꾸준 러너");
  }
  if (latestWin) {
    badges.push("추첨 당첨");
  }
  if ((me?.monthRuns || 0) >= threshold + 2) {
    badges.push("황금 추첨권");
  }
  if ((me?.streak || getAttendanceStreakFromMonth(me, selectedMonth)) >= 3) {
    badges.push("3개월 연속 출석");
  }
  if ((me?.streak || getAttendanceStreakFromMonth(me, selectedMonth)) >= 6) {
    badges.push("6개월 연속 출석");
  }
  if ((pointTotal || 0) >= 80) {
    badges.push("포인트 러너");
  }
  if (attendanceBonus.hangangLover) {
    badges.push("한강러버");
  }
  if (attendanceBonus.olympicLover) {
    badges.push("올공러버");
  }
  (Array.isArray(pointAwards) ? pointAwards : []).forEach((award) => {
    const label = String(award.award_label || "").trim();
    if (label && !badges.includes(label)) {
      badges.push(label);
    }
  });
  return badges;
}

function calculateMonthlyTickets(member, monthKey) {
  const monthRuns = getMonthlyRuns(member, monthKey);
  const threshold = getMonthThreshold(monthKey);
  return monthRuns >= threshold ? 1 : 0;
}

function calculateAttendancePoints(member, monthKey, attendanceLogs = []) {
  return calculateAttendanceBonus(member, monthKey, attendanceLogs).total;
}

function calculateAttendanceBonus(member, monthKey, attendanceLogs = []) {
  const state = getAttendanceBonusState(member, monthKey, attendanceLogs);
  const labels = [];
  let total = 0;
  if (getMonthlyRuns(member, monthKey) >= getMonthThreshold(monthKey)) {
    total += POINT_POLICY.monthlyCandidate;
    labels.push(`월 4회 달성 ${POINT_POLICY.monthlyCandidate}P`);
  }
  if (state.hangangLover) {
    total += POINT_POLICY.venueLover;
    labels.push(`한강러버 ${POINT_POLICY.venueLover}P`);
  }
  if (state.olympicLover) {
    total += POINT_POLICY.venueLover;
    labels.push(`올공러버 ${POINT_POLICY.venueLover}P`);
  }
  if (state.candidateStreak >= 3) {
    total += POINT_POLICY.candidateStreak3;
    labels.push(`3개월 연속 후보 ${POINT_POLICY.candidateStreak3}P`);
  } else if (state.candidateStreak >= 2) {
    total += POINT_POLICY.candidateStreak2;
    labels.push(`2개월 연속 후보 ${POINT_POLICY.candidateStreak2}P`);
  }
  return { total, labels, state };
}

function calculatePersonalMonthlyPoints({ me, selectedMonth, photoCount, commentCount, attendanceLogs, pointAwards }) {
  const activityBonusPoints = Number(me?.basePoints || 0);
  const awardPoints = (Array.isArray(pointAwards) ? pointAwards : []).reduce((sum, award) => sum + Number(award.points || 0), 0);
  return activityBonusPoints + awardPoints;
}

function calculatePersonalMonthlyPointBreakdown({ me, photoCount, commentCount, pointAwards }) {
  const rows = Array.isArray(pointAwards) ? pointAwards : [];
  const attendanceBonusPoints = Number(me?.attendanceBonusPoints || 0);
  const monthlyRunnerPoints = Number(me?.monthlyRunnerPoints || 0)
    + sumPointAwardRows(rows.filter((award) => award.award_code === "monthly_runner"));
  const awardPoints = sumPointAwardRows(rows.filter((award) => award.award_code !== "monthly_runner"));
  return {
    monthlyRunnerPoints,
    attendanceBonusPoints,
    awardPoints,
    total: attendanceBonusPoints + monthlyRunnerPoints + awardPoints
  };
}

function formatPointBreakdown(breakdown) {
  const parts = [];
  if (Number(breakdown?.awardPoints || 0) > 0) {
    parts.push(`지급 ${Number(breakdown.awardPoints).toLocaleString("ko-KR")}P`);
  }
  if (Number(breakdown?.monthlyRunnerPoints || 0) > 0) {
    parts.push(`이달의 러너 ${Number(breakdown.monthlyRunnerPoints).toLocaleString("ko-KR")}P`);
  }
  if (Number(breakdown?.attendanceBonusPoints || 0) > 0) {
    parts.push(`정기런 배지 ${Number(breakdown.attendanceBonusPoints).toLocaleString("ko-KR")}P`);
  }
  return parts.length ? `산식: ${parts.join(" + ")} = ${Number(breakdown?.total || 0).toLocaleString("ko-KR")}P` : "산식: 아직 적립된 포인트가 없습니다";
}

function getMemberPointTotal(member) {
  return Number(member?.pointTotal ?? member?.points ?? member?.basePoints ?? 0);
}

function getMonthlyRunner(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .filter((member) => Number(member.regularRuns || 0) > 0)
    .sort((a, b) => (Number(b.regularRuns || 0) - Number(a.regularRuns || 0)) || (Number(b.monthRuns || 0) - Number(a.monthRuns || 0)) || String(a.name || "").localeCompare(String(b.name || ""), "ko"))[0] || null;
}

function countRegularRunsForMember(member, monthKey, attendanceLogs = []) {
  const normalizedName = normalizeName(member?.name || "");
  if (!normalizedName) {
    return 0;
  }
  return (Array.isArray(attendanceLogs) ? attendanceLogs : []).filter((log) => {
    const logMonthKey = toMonthKey(log.attendance_date || log.date || "");
    const eventType = String(log.event_type || log.eventType || "");
    const matched = Array.isArray(log.matched) ? log.matched : [];
    return logMonthKey === monthKey
      && eventType.includes("정기런")
      && matched.some((name) => normalizeName(name) === normalizedName);
  }).length;
}

function getAttendanceBonusState(member, monthKey, attendanceLogs = []) {
  const memberLogs = getMemberAttendanceLogs(member, attendanceLogs);
  return {
    hangangLover: crossedVenueStreakMilestone(memberLogs, monthKey, 2, 10),
    olympicLover: crossedVenueStreakMilestone(memberLogs, monthKey, 4, 10),
    candidateStreak: getCandidateStreakFromMonth(member, monthKey)
  };
}

function getMemberAttendanceLogs(member, attendanceLogs = []) {
  const memberName = normalizeName(member?.name || authProfile?.name || "");
  if (!memberName) {
    return [];
  }
  return (Array.isArray(attendanceLogs) ? attendanceLogs : []).filter((log) => {
    const matched = Array.isArray(log?.matched) ? log.matched : [];
    return matched.some((name) => normalizeName(name) === memberName);
  });
}

function hasEveryRegularWeek(memberLogs, monthKey) {
  const regularDates = getRegularRunDatesInMonth(monthKey);
  const requiredWeeks = new Set(regularDates.map((date) => getWeekKey(date)));
  if (requiredWeeks.size < 4) {
    return false;
  }
  const attendedWeeks = new Set(
    memberLogs
      .filter((log) => isRegularVenueLog(log) && String(log.attendance_date || "").startsWith(monthKey))
      .map((log) => getWeekKey(parseIsoDateOnly(log.attendance_date)))
  );
  return Array.from(requiredWeeks).every((weekKey) => attendedWeeks.has(weekKey));
}

function crossedVenueStreakMilestone(memberLogs, monthKey, weekday, threshold) {
  const streakThroughMonth = getVenueConsecutiveAttendanceCount(memberLogs, monthKey, weekday);
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const streakBeforeMonth = getVenueConsecutiveAttendanceCount(memberLogs, previousMonthKey, weekday);
  return streakBeforeMonth < threshold && streakThroughMonth >= threshold;
}

function getVenueConsecutiveAttendanceCount(memberLogs, monthKey, weekday) {
  const attended = new Set(
    (Array.isArray(memberLogs) ? memberLogs : [])
      .filter(isRegularVenueLog)
      .map((log) => parseIsoDateOnly(log.attendance_date || log.date || ""))
      .filter((date) => date && date.getDay() === weekday)
      .map((date) => toIsoDateOnly(date))
  );
  let count = 0;
  const venueDates = getVenueRunDatesThroughMonth(monthKey, weekday);
  for (let index = venueDates.length - 1; index >= 0; index -= 1) {
    const dateKey = toIsoDateOnly(venueDates[index]);
    if (!attended.has(dateKey)) {
      break;
    }
    count += 1;
  }
  return count;
}

function getVenueRunDatesThroughMonth(monthKey, weekday) {
  const range = getMonthDateBoundary(monthKey);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const end = range.start > tomorrow ? range.start : new Date(Math.min(range.end.getTime(), tomorrow.getTime()));
  const dates = [];
  for (const date = new Date(ATTENDANCE_STREAK_START_MONTH + "-01"); date < end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() === weekday) {
      dates.push(new Date(date));
    }
  }
  return dates;
}

function getRegularRunDatesInMonth(monthKey) {
  const range = getMonthDateBoundary(monthKey);
  const dates = [];
  for (const date = new Date(range.start); date < range.end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() === 2 || date.getDay() === 4) {
      dates.push(new Date(date));
    }
  }
  return dates;
}

function isRegularVenueLog(log) {
  const eventType = String(log?.event_type || "");
  return !eventType || eventType.includes("정기");
}

function getMonthDateBoundary(monthKey) {
  const [year, month] = String(monthKey || currentMonthKey()).split("-").map(Number);
  const start = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

function parseIsoDateOnly(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function toIsoDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

function getNextReward(points) {
  const currentPoints = Number(points || 0);
  const nextTier = REWARD_ITEMS.find((tier) => currentPoints < tier.points);
  if (!nextTier) {
    return { label: "활동 혜택 프리미엄 구간", remaining: 0, won: currentPoints * POINT_WON_RATE };
  }
  return {
    label: nextTier.name,
    remaining: Math.max(nextTier.points - currentPoints, 0),
    won: currentPoints * POINT_WON_RATE
  };
}

function getPersonalFeeLabel(member, monthKey) {
  const feeStatus = member?.fee_status || member?.feeStatus || {};
  const raw = feeStatus?.[monthKey] ?? feeStatus?.monthly?.[monthKey] ?? feeStatus?.status ?? null;
  if (!raw) {
    return "확인 필요";
  }
  if (typeof raw === "string") {
    if (raw.includes("paid") || raw.includes("납부")) {
      return "납부 완료";
    }
    if (raw.includes("late") || raw.includes("경과")) {
      return "납부 기한 경과";
    }
    if (raw.includes("unpaid") || raw.includes("미납")) {
      return "미납";
    }
  }
  if (typeof raw === "object") {
    const status = String(raw.status || raw.state || "");
    if (status.includes("paid") || status.includes("납부")) {
      return "납부 완료";
    }
    if (status.includes("late") || status.includes("경과")) {
      return "납부 기한 경과";
    }
    if (status.includes("unpaid") || status.includes("미납")) {
      return "미납";
    }
  }
  return "확인 필요";
}

function getAttendanceStreakFromMonth(member, startMonthKey) {
  if (!member) {
    return 0;
  }
  let streak = 0;
  for (let i = 0; i < 12; i += 1) {
    const key = shiftMonthKey(startMonthKey, -i);
    if (compareMonthKey(key, ATTENDANCE_STREAK_START_MONTH) < 0) {
      break;
    }
    if (getMonthlyRuns(member, key) <= 0) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function getCandidateStreakFromMonth(member, startMonthKey) {
  if (!member) {
    return 0;
  }
  let streak = 0;
  for (let i = 0; i < 12; i += 1) {
    const key = shiftMonthKey(startMonthKey, -i);
    if (compareMonthKey(key, ATTENDANCE_STREAK_START_MONTH) < 0) {
      break;
    }
    if (getMonthlyRuns(member, key) < getMonthThreshold(key)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function compareMonthKey(left, right) {
  const [leftYear, leftMonth] = String(left || "").split("-").map(Number);
  const [rightYear, rightMonth] = String(right || "").split("-").map(Number);
  return ((leftYear || 0) * 12 + (leftMonth || 0)) - ((rightYear || 0) * 12 + (rightMonth || 0));
}

function formatStreakDelta(currentStreak, previousStreak) {
  if (currentStreak <= 0) {
    return "이번 달 새 기록 필요";
  }
  const delta = currentStreak - previousStreak;
  if (delta > 0) {
    return `+${delta}개월 이어짐`;
  }
  if (delta === 0) {
    return `${currentStreak}개월 유지 중`;
  }
    return "연속 출석 다시 시작";
}

function hasRaffleWinner(record, name) {
  if (!record || !name || !Array.isArray(record.winners)) {
    return false;
  }
  const normalized = normalizeName(name);
  return record.winners.some((winner) => normalizeName(winner?.name) === normalized);
}

function getMonthThreshold(monthKey) {
  return 4;
}
function loadLocalAdminMembers(expectedUserId) {
  try {
    const rawMeta = localStorage.getItem(ADMIN_SNAPSHOT_META_KEY);
    if (!rawMeta) {
      return [];
    }

    const meta = JSON.parse(rawMeta);
    const updatedAt = new Date(meta?.updatedAt || 0);
    const isRecent = Number.isFinite(updatedAt.getTime()) && (Date.now() - updatedAt.getTime() <= LOCAL_ADMIN_SNAPSHOT_MAX_AGE_MS);
    if (!meta?.active || !isRecent || (expectedUserId && meta.userId && meta.userId !== expectedUserId)) {
      return [];
    }

    const raw = localStorage.getItem("rrc-site-db-v3");
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.members) || !parsed.members.length) {
      return [];
    }

    const looksLikeSeedOnly = parsed.members.length === 1 && String(parsed.members[0]?.name || "") === "샘플회원";
    if (looksLikeSeedOnly) {
      return [];
    }

    return parsed.members.map((member) => ({
      id: member.id,
      name: String(member.name || "이름없음"),
      birth_year: Number(member.birthYear || member.birth_year || 0),
      total_runs: Number(member.totalRuns || member.total_runs || 0),
      fee_status: member.feeStatus || member.fee_status || {},
      monthly_runs: member.monthlyRuns && typeof member.monthlyRuns === "object"
        ? member.monthlyRuns
        : member.monthly_runs && typeof member.monthly_runs === "object"
          ? member.monthly_runs
          : {}
    }));
  } catch (_error) {
    return [];
  }
}

function toMonthKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function shiftMonthKey(monthKey, diff) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthKeyToLabel(key) {
  const [year, month] = key.split("-");
  return `${year}년 ${month}월`;
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function statusLabel(status) {
  if (status === "approved") {
    return "승인";
  }
  if (status === "rejected") {
    return "반려";
  }
  return "대기";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
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

function setStatus(node, message) {
  if (node && typeof message === "string") {
    node.textContent = message;
  }
}

function formatAuthNetworkError(error) {
  const message = String(error?.message || error || "").trim();
  if (window.location.protocol === "file:") {
    return "현재 로컬 파일로 열린 상태라 인증 요청이 브라우저에서 막힐 수 있습니다. Netlify 배포 주소 또는 로컬 서버 주소에서 다시 열어 주세요.";
  }
  if (/failed to fetch|network|fetch|timed out|timeout|abort/i.test(message)) {
    return "Supabase 인증 서버 요청이 막혔습니다. 인터넷 연결, 브라우저 차단, 배포 주소를 확인해 주세요.";
  }
  return message || "알 수 없는 오류가 발생했습니다.";
}

async function notifySignupRequest(payload) {
  try {
    await fetch("/.netlify/functions/signup-notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (_error) {
    // Notification failure should not block signup flow.
  }
}


























