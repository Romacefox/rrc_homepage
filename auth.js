const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PHOTO_BUCKET = "rrc-photos";

let supabaseClient = null;
let authUser = null;
let authProfile = null;

const yearNode = document.getElementById("year");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authNameInput = document.getElementById("auth-name");
const authBirthYearInput = document.getElementById("auth-birth-year");
const authIntroInput = document.getElementById("auth-intro");
const authAgreeInput = document.getElementById("auth-agree");

const authSignupButton = document.getElementById("auth-signup");
const authLoginButton = document.getElementById("auth-login");
const authLogoutButton = document.getElementById("auth-logout");
const authStatus = document.getElementById("auth-status");
const authApprovalStatus = document.getElementById("auth-approval-status");

const photoFileInput = document.getElementById("photo-file");
const photoCaptionInput = document.getElementById("photo-caption");
const photoUploadButton = document.getElementById("photo-upload");
const photoStatus = document.getElementById("photo-status");
const photoGrid = document.getElementById("photo-grid");

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

yearNode.textContent = new Date().getFullYear();
init();

function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    authStatus.textContent = "설정 필요: auth.js 상단 SUPABASE 값을 입력하세요.";
    disablePhotoUpload();
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    authStatus.textContent = "Supabase 라이브러리를 불러오지 못했습니다.";
    disablePhotoUpload();
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  populateActivityMonthOptions();

  authSignupButton.addEventListener("click", handleSignup);
  authLoginButton.addEventListener("click", handleLogin);
  authLogoutButton.addEventListener("click", handleLogout);
  photoUploadButton.addEventListener("click", handlePhotoUpload);
  activityRefreshButton?.addEventListener("click", loadActivityBoard);
  activityMonthSelect?.addEventListener("change", loadActivityBoard);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    authUser = session?.user || null;
    await loadMyProfile();
    renderAuthState();
    await loadPhotos();
    await loadActivityBoard();
  });

  supabaseClient.auth.getSession().then(async ({ data }) => {
    authUser = data?.session?.user || null;
    await loadMyProfile();
    renderAuthState();
    await loadPhotos();
    await loadActivityBoard();
  });
}

async function handleSignup() {
  const email = String(authEmailInput.value || "").trim();
  const password = String(authPasswordInput.value || "").trim();
  const name = String(authNameInput.value || "").trim();
  const birthYear = Number(authBirthYearInput.value || 0);
  const intro = String(authIntroInput.value || "").trim();
  const agreed = Boolean(authAgreeInput.checked);

  if (!email || !password || !name || !birthYear) {
    authStatus.textContent = "이메일/비밀번호/이름/출생연도는 필수입니다.";
    return;
  }
  if (birthYear < 1989 || birthYear > 2000) {
    authStatus.textContent = "출생연도는 1989~2000만 가능합니다.";
    return;
  }
  if (!agreed) {
    authStatus.textContent = "개인정보 수집 동의가 필요합니다.";
    return;
  }

  const signUpResult = await supabaseClient.auth.signUp({ email, password });
  if (signUpResult.error) {
    authStatus.textContent = `가입 실패: ${signUpResult.error.message}`;
    return;
  }

  const userId = signUpResult.data?.user?.id;
  if (userId) {
    const profileInsert = await supabaseClient.from("member_profiles").insert({
      user_id: userId,
      email,
      name,
      birth_year: birthYear,
      intro,
      role: "member",
      approval_status: "pending"
    });

    if (profileInsert.error && profileInsert.error.code !== "23505") {
      authStatus.textContent = `가입은 되었지만 프로필 저장 실패: ${profileInsert.error.message}`;
      return;
    }

    notifySignupRequest({ email, name, birthYear, intro });
  }

  authStatus.textContent = "가입 신청 완료. 운영진 승인 후 사진 업로드와 활동 보드 확인이 가능합니다.";
  authApprovalStatus.textContent = "승인 상태: 대기";
}

async function handleLogin() {
  const email = String(authEmailInput.value || "").trim();
  const password = String(authPasswordInput.value || "").trim();

  if (!email || !password) {
    authStatus.textContent = "이메일/비밀번호를 입력하세요.";
    return;
  }

  const loginResult = await supabaseClient.auth.signInWithPassword({ email, password });
  if (loginResult.error) {
    authStatus.textContent = `로그인 실패: ${loginResult.error.message}`;
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
  authApprovalStatus.textContent = "로그인 필요";
  disablePhotoUpload();
  renderBoardLocked("승인된 회원 로그인 후 활동 보드를 볼 수 있습니다.");
}

async function loadMyProfile() {
  authProfile = null;
  if (!supabaseClient || !authUser) {
    return;
  }

  const profileResult = await supabaseClient
    .from("member_profiles")
    .select("user_id,email,name,birth_year,intro,approval_status")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!profileResult.error) {
    authProfile = profileResult.data;
  }
}

function renderAuthState() {
  if (!authUser) {
    authStatus.textContent = "로그인 필요";
    authApprovalStatus.textContent = "승인 상태: 로그인 필요";
    disablePhotoUpload();
    return;
  }

  authStatus.textContent = `로그인됨: ${authUser.email}`;

  if (!authProfile) {
    authApprovalStatus.textContent = "승인 상태: 프로필 미등록(운영진 문의)";
    disablePhotoUpload();
    return;
  }

  const isApproved = authProfile.approval_status === "approved";
  authApprovalStatus.textContent = `승인 상태: ${statusLabel(authProfile.approval_status)}${isApproved ? " / 사진 업로드 가능" : " / 승인 후 업로드 가능"}`;
  if (isApproved) {
    enablePhotoUpload();
    return;
  }

  disablePhotoUpload("운영진 승인 후 사진 업로드가 가능합니다.");
}

function disablePhotoUpload(message = "로그인한 회원만 업로드 가능합니다.") {
  photoUploadButton.disabled = true;
  photoFileInput.disabled = true;
  photoCaptionInput.disabled = true;
  photoStatus.textContent = message;
}

function enablePhotoUpload() {
  photoUploadButton.disabled = false;
  photoFileInput.disabled = false;
  photoCaptionInput.disabled = false;
  photoStatus.textContent = "승인 완료. 사진을 업로드할 수 있습니다.";
}

async function handlePhotoUpload() {
  if (!authUser || !authProfile) {
    photoStatus.textContent = "로그인한 회원만 업로드할 수 있습니다.";
    return;
  }
  if (authProfile.approval_status !== "approved") {
    photoStatus.textContent = "운영진 승인 후 사진 업로드가 가능합니다.";
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

  const photosResult = await supabaseClient
    .from("photos")
    .select("id,file_path,caption,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (photosResult.error) {
    photoStatus.textContent = `사진 목록 로드 실패: ${photosResult.error.message}`;
    return;
  }

  const data = photosResult.data || [];
  photoGrid.innerHTML = "";

  if (!data.length) {
    photoGrid.innerHTML = '<p class="list-meta">아직 업로드된 사진이 없습니다.</p>';
    return;
  }

  data.forEach((photo) => {
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
    .select("id,name,total_runs,monthly_runs")
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

  const me = rows.find((member) => normalizeName(member.name) === normalizeName(authProfile.name));
  const runner = rows.find((member) => member.monthRuns > 0) || null;

  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} 출석 기준입니다. 운영진이 동기화한 데이터로 표시됩니다.`;
  activityLock.classList.remove("hidden");
  activityBoard.classList.remove("hidden");

  myMonthRuns.textContent = `${me?.monthRuns || 0}회`;
  myTotalRuns.textContent = `${Number(me?.total_runs || 0)}회`;
  myStreak.textContent = `${me?.streak || 0}개월`;

  renderAttendanceBoard(rows, selectedMonth);
  renderRunnerCard(runner, selectedMonth);
  renderBoardRaffleHistory(Array.isArray(raffleResult.data) ? raffleResult.data : []);
}

function renderBoardLocked(message) {
  activityLock.textContent = message;
  activityLock.classList.remove("hidden");
  activityBoard.classList.add("hidden");
}

function renderAttendanceBoard(rows, monthKey) {
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

function populateActivityMonthOptions() {
  if (!activityMonthSelect) {
    return;
  }
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    options.push(`<option value="${key}">${monthKeyToLabel(key)}</option>`);
  }
  activityMonthSelect.innerHTML = options.join("");
  activityMonthSelect.value = currentMonthKey();
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
    : member?.monthlyRuns && typeof member.monthlyRuns === "object"
      ? member.monthlyRuns
      : {};
  return Number(monthlyRuns[monthKey] || 0);
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
