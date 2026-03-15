const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PHOTO_BUCKET = "rrc-photos";
const PENDING_SIGNUP_PREFIX = "rrc-pending-signup:";

let supabaseClient = null;
let authUser = null;
let authProfile = null;
let photoRecords = [];

const yearNode = document.getElementById("year");

const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
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
const loginForm = document.getElementById("login-form");
const loginGuestActions = document.getElementById("login-guest-actions");
const loginMemberActions = document.getElementById("login-member-actions");
const authShell = document.querySelector(".auth-shell");

const galleryAuthStatus = document.getElementById("gallery-auth-status");
const galleryApprovalStatus = document.getElementById("gallery-approval-status");
const galleryGuestActions = document.getElementById("gallery-guest-actions");
const galleryMemberActions = document.getElementById("gallery-member-actions");
const photoFileInput = document.getElementById("photo-file");
const photoCaptionInput = document.getElementById("photo-caption");
const photoUploadButton = document.getElementById("photo-upload");
const photoStatus = document.getElementById("photo-status");
const photoGrid = document.getElementById("photo-grid");
const photoMonthFilter = document.getElementById("photo-month-filter");
const photoFilterResetButton = document.getElementById("photo-filter-reset");

const activityMonthSelect = document.getElementById("activity-month");
const activityRefreshButton = document.getElementById("activity-refresh");
const activityLock = document.getElementById("activity-lock");
const activityBoard = document.getElementById("activity-board");
const myMonthRuns = document.getElementById("my-month-runs");
const myTotalRuns = document.getElementById("my-total-runs");
const myStreak = document.getElementById("my-streak");
const runnerMonthLabel = document.getElementById("runner-month-label");
const runnerCard = document.getElementById("runner-card");
const attendanceBoard = document.getElementById("attendance-board");
const boardRaffleHistory = document.getElementById("board-raffle-history");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}
init();

function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setStatus(loginStatus, "설정 필요: auth.js 상단 SUPABASE 값을 입력하세요.");
    setStatus(signupStatus, "설정 필요: auth.js 상단 SUPABASE 값을 입력하세요.");
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

  signupForm?.addEventListener("submit", handleSignup);
  loginForm?.addEventListener("submit", handleLogin);
  loginLogoutButton?.addEventListener("click", handleLogout);
  photoUploadButton?.addEventListener("click", handlePhotoUpload);
  photoMonthFilter?.addEventListener("change", renderFilteredPhotos);
  photoFilterResetButton?.addEventListener("click", () => {
    if (photoMonthFilter) {
      photoMonthFilter.value = "all";
    }
    renderFilteredPhotos();
  });
  activityRefreshButton?.addEventListener("click", loadActivityBoard);
  activityMonthSelect?.addEventListener("change", loadActivityBoard);

  if (activityMonthSelect) {
    populateRecentMonthOptions(activityMonthSelect);
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    authUser = session?.user || null;
    await refreshAuthSession();
  });

  supabaseClient.auth.getSession().then(async ({ data }) => {
    authUser = data?.session?.user || null;
    await refreshAuthSession();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !supabaseClient) {
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    authUser = data?.session?.user || null;
    await refreshAuthSession();
  });
}

async function refreshAuthSession() {
  await ensurePendingProfile();
  await loadMyProfile();
  renderAuthState();
  await loadPhotos();
  await loadActivityBoard();
}

async function handleSignup(event) {
  event?.preventDefault();

  const payload = {
    email: String(signupEmailInput?.value || "").trim(),
    password: String(signupPasswordInput?.value || "").trim(),
    name: String(signupNameInput?.value || "").trim(),
    birthYear: Number(signupBirthYearInput?.value || 0),
    intro: String(signupIntroInput?.value || "").trim(),
    agreed: Boolean(signupAgreeInput?.checked)
  };

  if (!payload.email || !payload.password || !payload.name || !payload.birthYear) {
    setStatus(signupStatus, "이메일/비밀번호/이름/출생연도는 필수입니다.");
    return;
  }
  if (payload.birthYear < 1989 || payload.birthYear > 2000) {
    setStatus(signupStatus, "출생연도는 1989~2000만 가능합니다.");
    return;
  }
  if (!payload.agreed) {
    setStatus(signupStatus, "개인정보 수집 동의가 필요합니다.");
    return;
  }

  const signUpResult = await supabaseClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login.html`
    }
  });
  if (signUpResult.error) {
    setStatus(signupStatus, `가입 실패: ${signUpResult.error.message}`);
    return;
  }

  const userId = signUpResult.data?.user?.id;
  const profilePayload = {
    user_id: userId,
    email: payload.email,
    name: payload.name,
    birth_year: payload.birthYear,
    intro: payload.intro,
    role: "member",
    approval_status: "pending"
  };

  if (userId) {
    const profileInsert = await supabaseClient.from("member_profiles").insert(profilePayload);
    if (profileInsert.error && profileInsert.error.code !== "23505") {
      localStorage.setItem(`${PENDING_SIGNUP_PREFIX}${payload.email.toLowerCase()}`, JSON.stringify(profilePayload));
      setStatus(signupStatus, "가입 계정은 생성되었습니다. 이메일 인증 후 로그인하면 프로필이 자동 저장되고 운영진 승인을 기다리게 됩니다.");
      return;
    }
    localStorage.removeItem(`${PENDING_SIGNUP_PREFIX}${payload.email.toLowerCase()}`);
    await notifySignupRequest(payload);
  }

  setStatus(signupStatus, "가입 신청 완료. 이메일 인증 후 로그인하면 운영진 승인 상태를 확인할 수 있습니다.");
}

async function handleLogin(event) {
  event?.preventDefault();

  const email = String(loginEmailInput?.value || "").trim();
  const password = String(loginPasswordInput?.value || "").trim();

  if (!email || !password) {
    setStatus(loginStatus, "이메일/비밀번호를 입력하세요.");
    return;
  }

  const loginResult = await supabaseClient.auth.signInWithPassword({ email, password });
  if (loginResult.error) {
    setStatus(loginStatus, `로그인 실패: ${loginResult.error.message}`);
    return;
  }

  setStatus(loginStatus, "로그인 성공. 활동 보드를 확인해 주세요.");
}

async function handleLogout() {
  if (!supabaseClient) {
    return;
  }
  await supabaseClient.auth.signOut();
  if (loginPasswordInput) {
    loginPasswordInput.value = "";
  }
  setStatus(loginStatus, "로그아웃 완료");
  setStatus(galleryAuthStatus, "로그인 필요");
  setStatus(galleryApprovalStatus, "승인 상태 확인 후 업로드가 열립니다.");
  disablePhotoUpload();
  renderBoardLocked("승인된 회원 로그인 후 월별 출석, 출석 스트릭, 이달의 러너를 볼 수 있습니다.");
}

async function ensurePendingProfile() {
  if (!authUser?.email) {
    return;
  }
  const key = `${PENDING_SIGNUP_PREFIX}${String(authUser.email).toLowerCase()}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    return;
  }

  try {
    const payload = JSON.parse(raw);
    payload.user_id = authUser.id;
    const profileInsert = await supabaseClient.from("member_profiles").insert(payload);
    if (!profileInsert.error || profileInsert.error.code === "23505") {
      localStorage.removeItem(key);
      await notifySignupRequest({
        email: payload.email,
        name: payload.name,
        birthYear: payload.birth_year,
        intro: payload.intro
      });
    }
  } catch (_error) {
    // Keep pending payload for the next login attempt.
  }
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
  if (!authUser) {
    updateLoginLayout(false);
    setStatus(loginStatus, loginStatus ? "로그인 필요" : null);
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 로그인 필요" : null);
    setStatus(galleryAuthStatus, galleryAuthStatus ? "로그인 필요" : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "승인 상태 확인 후 업로드가 열립니다." : null);
    if (galleryGuestActions) galleryGuestActions.classList.remove("hidden");
    if (galleryMemberActions) galleryMemberActions.classList.add("hidden");
    disablePhotoUpload();
    return;
  }

  updateLoginLayout(true);
  const roleSuffix = authProfile?.role === "admin" ? " / 모임장·운영진 권한 포함" : "";
  setStatus(loginStatus, loginStatus ? `로그인됨: ${authUser.email}` : null);
  setStatus(galleryAuthStatus, galleryAuthStatus ? `로그인됨: ${authUser.email}` : null);
  if (galleryGuestActions) galleryGuestActions.classList.add("hidden");
  if (galleryMemberActions) galleryMemberActions.classList.remove("hidden");

  if (!authProfile) {
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 프로필 미등록(운영진 문의)" : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "승인 상태: 프로필 미등록(운영진 문의)" : null);
    disablePhotoUpload();
    return;
  }

  const label = `승인 상태: ${statusLabel(authProfile.approval_status)}${roleSuffix}`;
  setStatus(loginApprovalStatus, loginApprovalStatus ? label : null);
  setStatus(galleryApprovalStatus, galleryApprovalStatus ? label : null);

  if (authProfile.approval_status === "approved") {
    enablePhotoUpload();
    return;
  }

  disablePhotoUpload("운영진 승인 후 사진 업로드가 가능합니다.");
}

function updateLoginLayout(isLoggedIn) {
  if (loginForm) {
    loginForm.classList.toggle("hidden", isLoggedIn);
  }
  if (loginGuestActions) {
    loginGuestActions.classList.toggle("hidden", isLoggedIn);
  }
  if (loginMemberActions) {
    loginMemberActions.classList.toggle("hidden", !isLoggedIn);
  }
  if (loginPanelTitle) {
    loginPanelTitle.textContent = isLoggedIn ? "내 활동" : "로그인";
  }
  if (loginPanel) {
    loginPanel.classList.toggle("login-panel-success", isLoggedIn);
  }
  if (authShell) {
    authShell.classList.toggle("auth-shell-logged-in", isLoggedIn);
  }
}

function disablePhotoUpload(message = "로그인한 회원만 업로드 가능합니다.") {
  if (photoUploadButton) {
    photoUploadButton.disabled = true;
  }
  if (photoFileInput) {
    photoFileInput.disabled = true;
  }
  if (photoCaptionInput) {
    photoCaptionInput.disabled = true;
  }
  setStatus(photoStatus, photoStatus ? message : null);
}

function enablePhotoUpload() {
  if (photoUploadButton) {
    photoUploadButton.disabled = false;
  }
  if (photoFileInput) {
    photoFileInput.disabled = false;
  }
  if (photoCaptionInput) {
    photoCaptionInput.disabled = false;
  }
  setStatus(photoStatus, photoStatus ? "승인 완료. 사진을 업로드할 수 있습니다." : null);
}

async function handlePhotoUpload() {
  if (!authUser || !authProfile) {
    setStatus(photoStatus, photoStatus ? "로그인한 회원만 업로드할 수 있습니다." : null);
    return;
  }
  if (authProfile.approval_status !== "approved") {
    setStatus(photoStatus, photoStatus ? "운영진 승인 후 사진 업로드가 가능합니다." : null);
    return;
  }

  const file = photoFileInput?.files?.[0];
  if (!file) {
    setStatus(photoStatus, photoStatus ? "업로드할 사진 파일을 선택하세요." : null);
    return;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${authUser.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  setStatus(photoStatus, photoStatus ? "업로드 중..." : null);

  const uploadResult = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type
  });
  if (uploadResult.error) {
    setStatus(photoStatus, photoStatus ? `업로드 실패: ${uploadResult.error.message}` : null);
    return;
  }

  const caption = String(photoCaptionInput?.value || "").trim();
  const insertResult = await supabaseClient.from("photos").insert({
    user_id: authUser.id,
    file_path: path,
    caption
  });

  if (insertResult.error) {
    setStatus(photoStatus, photoStatus ? `메타 저장 실패: ${insertResult.error.message}` : null);
    return;
  }

  if (photoFileInput) {
    photoFileInput.value = "";
  }
  if (photoCaptionInput) {
    photoCaptionInput.value = "";
  }
  setStatus(photoStatus, photoStatus ? "업로드 완료" : null);
  await loadPhotos();
}

async function loadPhotos() {
  if (!supabaseClient || !photoGrid) {
    return;
  }

  const photosResult = await supabaseClient
    .from("photos")
    .select("id,file_path,caption,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (photosResult.error) {
    setStatus(photoStatus, photoStatus ? `사진 목록 로드 실패: ${photosResult.error.message}` : null);
    return;
  }

  photoRecords = Array.isArray(photosResult.data) ? photosResult.data : [];
  populatePhotoMonthOptions();
  renderFilteredPhotos();
}

function populatePhotoMonthOptions() {
  if (!photoMonthFilter) {
    return;
  }
  const seen = new Set();
  const options = ['<option value="all">전체 월</option>'];
  photoRecords.forEach((photo) => {
    const key = toMonthKey(photo.created_at);
    if (!seen.has(key)) {
      seen.add(key);
      options.push(`<option value="${key}">${monthKeyToLabel(key)}</option>`);
    }
  });
  photoMonthFilter.innerHTML = options.join("");
}

function renderFilteredPhotos() {
  if (!photoGrid) {
    return;
  }
  const selected = photoMonthFilter?.value || "all";
  const filtered = selected === "all"
    ? photoRecords
    : photoRecords.filter((photo) => toMonthKey(photo.created_at) === selected);

  photoGrid.innerHTML = "";
  if (!filtered.length) {
    photoGrid.innerHTML = '<p class="list-meta">선택한 월의 사진이 없습니다.</p>';
    return;
  }

  filtered.forEach((photo) => {
    const { data: urlData } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(photo.file_path);
    const card = document.createElement("article");
    card.className = "photo-item";
    card.innerHTML = `
      <img src="${urlData.publicUrl}" alt="RRC photo" loading="lazy" />
      <div class="photo-meta">
        <div>${escapeHtml(photo.caption || "무설명")}</div>
        <div>${formatDate(photo.created_at)}</div>
      </div>
    `;
    photoGrid.appendChild(card);
  });
}

async function loadActivityBoard() {
  if (!supabaseClient || !activityBoard || !activityLock) {
    return;
  }
  const selectedMonth = activityMonthSelect?.value || currentMonthKey();
  if (runnerMonthLabel) {
    runnerMonthLabel.textContent = `${monthKeyToLabel(selectedMonth)} 기준`;
  }

  if (!authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderBoardLocked("승인된 회원 로그인 후 월별 출석, 출석 스트릭, 이달의 러너를 볼 수 있습니다.");
    return;
  }

  const membersResult = await supabaseClient
    .from("members")
    .select("id,name,birth_year,total_runs,monthly_runs")
    .order("name", { ascending: true });

  if (membersResult.error) {
    renderBoardLocked(`활동 보드 로드 실패: ${membersResult.error.message}`);
    return;
  }

  const raffleResult = await supabaseClient
    .from("raffle_history")
    .select("target_month_key,threshold,winner_count,winners,created_at")
    .order("created_at", { ascending: false })
    .limit(4);

  const members = Array.isArray(membersResult.data) ? membersResult.data : [];
  const rows = members
    .map((member) => ({
      ...member,
      monthRuns: getMonthlyRuns(member, selectedMonth),
      streak: getAttendanceStreak(member)
    }))
    .sort((a, b) => (b.monthRuns - a.monthRuns) || (Number(b.total_runs || 0) - Number(a.total_runs || 0)) || String(a.name || "").localeCompare(String(b.name || ""), "ko"));

  const profileBirthYear = Number(authProfile.birth_year || 0);
  const me = rows.find((member) => {
    const sameName = normalizeName(member.name) === normalizeName(authProfile.name);
    if (!sameName) {
      return false;
    }
    const memberBirthYear = Number(member.birth_year || 0);
    if (profileBirthYear && memberBirthYear) {
      return profileBirthYear === memberBirthYear;
    }
    return true;
  });
  const runner = rows.find((member) => member.monthRuns > 0) || null;

  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} 출석 기준입니다. 운영진이 동기화한 데이터로 표시됩니다.`;
  activityBoard.classList.remove("hidden");

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
  renderRunnerCard(runner, selectedMonth);
  renderBoardRaffleHistory(Array.isArray(raffleResult.data) ? raffleResult.data : []);
}

function renderBoardLocked(message) {
  if (activityLock) {
    activityLock.textContent = message;
  }
  if (activityBoard) {
    activityBoard.classList.add("hidden");
  }
}

function renderAttendanceBoard(rows, monthKey) {
  if (!attendanceBoard) {
    return;
  }
  attendanceBoard.innerHTML = "";
  if (!rows.length) {
    attendanceBoard.innerHTML = '<li class="list-item"><p class="list-meta">동기화된 회원 데이터가 없습니다.</p></li>';
    return;
  }

  rows.forEach((member, index) => {
    const item = document.createElement("li");
    item.className = "list-item";
    const badge = index === 0 && member.monthRuns > 0
      ? '<span class="status-chip">선두</span>'
      : member.monthRuns >= 5
        ? '<span class="status-chip">추첨대상</span>'
        : "";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${index + 1}. ${escapeHtml(member.name || "이름없음")}${badge}</span>
        <span class="list-meta">${monthKeyToLabel(monthKey)} ${member.monthRuns}회</span>
      </div>
      <p class="list-meta">누적 ${Number(member.total_runs || 0)}회 / 출석 스트릭 ${member.streak}개월</p>
    `;
    attendanceBoard.appendChild(item);
  });
}

function renderRunnerCard(runner, monthKey) {
  if (!runnerCard) {
    return;
  }
  if (!runner || runner.monthRuns === 0) {
    runnerCard.innerHTML = `<p class="list-meta">${monthKeyToLabel(monthKey)}에는 아직 출석 기록이 없습니다.</p>`;
    return;
  }

  runnerCard.innerHTML = `
    <p class="list-meta">${monthKeyToLabel(monthKey)} 최다 출석</p>
    <h3 style="margin:0.2rem 0 0.4rem;">${escapeHtml(runner.name || "이름없음")}</h3>
    <p>${runner.monthRuns}회 출석 / 누적 ${Number(runner.total_runs || 0)}회</p>
    <p class="list-meta">출석 스트릭 ${runner.streak}개월</p>
  `;
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

function populateRecentMonthOptions(selectNode) {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    options.push(`<option value="${key}">${monthKeyToLabel(key)}</option>`);
  }
  selectNode.innerHTML = options.join("");
  selectNode.value = currentMonthKey();
}

function getAttendanceStreak(member) {
  let streak = 0;
  for (let i = 0; i < 12; i += 1) {
    const key = shiftMonthKey(currentMonthKey(), -i);
    if (getMonthlyRuns(member, key) <= 0) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function getMonthlyRuns(member, monthKey) {
  const monthlyRuns = member?.monthly_runs && typeof member.monthly_runs === "object"
    ? member.monthly_runs
    : {};
  return Number(monthlyRuns[monthKey] || 0);
}

function toMonthKey(iso) {
  const date = new Date(iso);
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
