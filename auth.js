const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PHOTO_BUCKET = "rrc-photos";
const PENDING_SIGNUP_PREFIX = "rrc-pending-signup:";
const ADMIN_SNAPSHOT_META_KEY = "rrc-admin-snapshot-meta-v1";
const LOCAL_ADMIN_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let supabaseClient = null;
let authUser = null;
let authProfile = null;
let photoRecords = [];
let photoLikeCounts = new Map();
let photoLikedByMe = new Set();
let currentPhotoRecord = null;

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
const myFeeStatus = document.getElementById("my-fee-status");
const myRaffleStatus = document.getElementById("my-raffle-status");
const myStreakChange = document.getElementById("my-streak-change");
const myBadges = document.getElementById("my-badges");
const myPhotoHistory = document.getElementById("my-photo-history");
const myCommentHistory = document.getElementById("my-comment-history");
const myRaffleHistory = document.getElementById("my-raffle-history");
const memberNavLinks = document.querySelectorAll("[data-member-nav]");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");
const authEntryLinks = document.querySelectorAll("[data-auth-entry]");
const photoModal = document.getElementById("photo-modal");
const photoModalImage = document.getElementById("photo-modal-image");
const photoModalCaption = document.getElementById("photo-modal-caption");
const photoModalDate = document.getElementById("photo-modal-date");
const photoLikeButton = document.getElementById("photo-like-button");
const photoLikeCount = document.getElementById("photo-like-count");
const photoModalClose = document.getElementById("photo-modal-close");
const photoModalBackdrop = document.querySelector("[data-photo-modal-close]");
const photoCommentLock = document.getElementById("photo-comment-lock");
const photoCommentForm = document.getElementById("photo-comment-form");
const photoCommentInput = document.getElementById("photo-comment-input");
const photoCommentStatus = document.getElementById("photo-comment-status");
const photoCommentList = document.getElementById("photo-comment-list");

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
    const compose = params.get("compose") === "1";

    if (next === "running") {
      return compose ? "running.html#running-compose-section" : "running.html";
    }
    if (next === "gallery") {
      return "gallery.html";
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
  photoUploadButton?.addEventListener("click", handlePhotoUpload);
  photoMonthFilter?.addEventListener("change", renderFilteredPhotos);
  photoFilterResetButton?.addEventListener("click", () => {
    if (photoMonthFilter) {
      photoMonthFilter.value = "all";
    }
    renderFilteredPhotos();
  });
  photoModalClose?.addEventListener("click", closePhotoModal);
  photoModalBackdrop?.addEventListener("click", closePhotoModal);
  photoCommentForm?.addEventListener("submit", handlePhotoCommentSubmit);
  photoLikeButton?.addEventListener("click", handlePhotoLikeToggle);
  activityRefreshButton?.addEventListener("click", loadActivityBoard);
  activityMonthSelect?.addEventListener("change", loadActivityBoard);

  if (activityMonthSelect) {
    populateRecentMonthOptions(activityMonthSelect);
  }

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
  await Promise.allSettled([loadPhotos(), loadActivityBoard()]);
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
    setStatus(signupStatus, "이메일, 비밀번호, 이름, 출생연도는 필수입니다.");
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

  localStorage.setItem(`${PENDING_SIGNUP_PREFIX}${payload.email.toLowerCase()}`, JSON.stringify({
    user_id: null,
    email: payload.email,
    name: payload.name,
    birth_year: payload.birthYear,
    intro: payload.intro,
    role: "member",
    approval_status: "pending"
  }));

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
    localStorage.removeItem(`${PENDING_SIGNUP_PREFIX}${payload.email.toLowerCase()}`);
    setStatus(signupStatus, `가입 실패: ${signUpResult.error.message}`);
    return;
  }

  setStatus(signupStatus, "가입 신청이 완료되었습니다. 이메일 인증 후 로그인하면 운영진 승인 대기 상태로 연결됩니다.");
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
    const loginResult = await supabaseClient.auth.signInWithPassword({ email, password });
    if (loginResult.error) {
      setStatus(loginStatus, `로그인 실패: ${loginResult.error.message}`);
      return;
    }

    const signedInUser = loginResult.data?.session?.user || loginResult.data?.user || null;
    await hydrateAuthState(signedInUser);

    if (!authUser) {
      setStatus(loginStatus, "로그인은 되었지만 세션 확인에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setStatus(loginStatus, `로그인됨: ${authUser.email}`);
  } finally {
    if (loginSubmitButton) {
      loginSubmitButton.disabled = false;
    }
  }
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
  renderBoardLocked("승인 회원 로그인 후 월별 출석, 출석 스트릭, 이달의 러너를 볼 수 있습니다.");
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
    const profileInsert = await supabaseClient
      .from("member_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (!profileInsert.error) {
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
  const isAdmin = Boolean(authProfile && authProfile.role === "admin" && authProfile.approval_status === "approved");
  const isApproved = Boolean(authProfile && authProfile.approval_status === "approved");

  if (!authUser) {
    updateLoginLayout(false);
    updateSharedNavigation(false, false);
    setVisibility(galleryGuestActions, true);
    setVisibility(galleryMemberActions, false);
    setStatus(loginStatus, loginStatus ? "로그인이 필요합니다." : null);
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 로그인 필요" : null);
    setStatus(galleryAuthStatus, galleryAuthStatus ? "로그인이 필요합니다." : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "승인 상태 확인 후 이용할 수 있습니다." : null);
    disablePhotoUpload();
    updatePhotoCommentComposer(false);
    return;
  }

  if (redirectAfterLoginIfNeeded()) {
    return;
  }

  updateLoginLayout(true);
  updateSharedNavigation(true, isAdmin);
  setVisibility(galleryGuestActions, false);
  setVisibility(galleryMemberActions, true);
  const roleSuffix = isAdmin ? " / 운영진 권한 있음" : "";
  setStatus(loginStatus, loginStatus ? `로그인됨: ${authUser.email}` : null);
  setStatus(galleryAuthStatus, galleryAuthStatus ? `로그인됨: ${authUser.email}` : null);

  if (!authProfile) {
    setStatus(loginApprovalStatus, loginApprovalStatus ? "승인 상태: 프로필 미등록(운영진 문의)" : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "승인 상태: 프로필 미등록(운영진 문의)" : null);
    disablePhotoUpload();
    updatePhotoCommentComposer(false);
    return;
  }

  const label = `승인 상태: ${statusLabel(authProfile.approval_status)}${roleSuffix}`;
  setStatus(loginApprovalStatus, loginApprovalStatus ? label : null);
  setStatus(galleryApprovalStatus, galleryApprovalStatus ? label : null);

  enablePhotoUpload(isApproved);
  updatePhotoCommentComposer(isApproved);
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
    loginPanelTitle.textContent = isLoggedIn ? "활동 보드" : "로그인";
  }
  if (loginPanel) {
    loginPanel.classList.toggle("login-panel-success", isLoggedIn);
  }
  if (authShell) {
    authShell.classList.toggle("auth-shell-logged-in", isLoggedIn);
  }
}

function updatePhotoCommentComposer(canComment) {
  setVisibility(photoCommentForm, canComment);
  if (photoCommentLock) {
    photoCommentLock.textContent = canComment
      ? "승인 회원은 사진에 댓글을 남길 수 있습니다."
      : "승인 회원 로그인 후 댓글 작성이 열립니다.";
  }
}

function disablePhotoUpload(message = "로그인한 회원만 업로드할 수 있습니다.") {
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

function enablePhotoUpload(isApproved = false) {
  if (photoUploadButton) {
    photoUploadButton.disabled = false;
  }
  if (photoFileInput) {
    photoFileInput.disabled = false;
  }
  if (photoCaptionInput) {
    photoCaptionInput.disabled = false;
  }
  const message = isApproved
    ? "사진 업로드가 가능합니다."
    : "로그인 회원은 업로드할 수 있지만, 일부 상호작용은 승인 후 열립니다.";
  setStatus(photoStatus, photoStatus ? message : null);
}

async function handlePhotoUpload() {
  if (!authUser || !authProfile) {
    setStatus(photoStatus, photoStatus ? "로그인한 회원만 업로드할 수 있습니다." : null);
    return;
  }
  const file = photoFileInput?.files?.[0];
  if (!file) {
    setStatus(photoStatus, photoStatus ? "업로드할 사진 파일을 선택해 주세요." : null);
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
    await supabaseClient.storage.from(PHOTO_BUCKET).remove([path]);
    setStatus(photoStatus, photoStatus ? `메타데이터 저장 실패: ${insertResult.error.message}` : null);
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

  const [photosResult, likesResult] = await Promise.all([
    supabaseClient
      .from("photos")
      .select("id,file_path,caption,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseClient
      .from("photo_likes")
      .select("photo_id,user_id")
  ]);

  if (photosResult.error) {
    setStatus(photoStatus, photoStatus ? `사진 목록 로드 실패: ${photosResult.error.message}` : null);
    return;
  }

  photoRecords = Array.isArray(photosResult.data) ? photosResult.data : [];
  hydratePhotoLikes(Array.isArray(likesResult.data) ? likesResult.data : []);

  if (likesResult.error) {
    setStatus(photoStatus, photoStatus ? `좋아요 정보 일부 로드 실패: ${likesResult.error.message}` : null);
  }

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
    const publicUrl = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(photo.file_path).data.publicUrl;
    const likeCount = Number(photoLikeCounts.get(photo.id) || 0);
    const card = document.createElement("article");
    card.className = "photo-item";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <img src="${publicUrl}" alt="RRC photo" loading="lazy" />
      <div class="photo-meta">
        <div>${escapeHtml(photo.caption || "설명 없음")}</div>
        <div class="photo-meta-row">
          <span>${formatDate(photo.created_at)}</span>
          <span class="list-meta">좋아요 ${likeCount}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openPhotoModal(photo, publicUrl));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPhotoModal(photo, publicUrl);
      }
    });
    photoGrid.appendChild(card);
  });
}

function openPhotoModal(photo, publicUrl) {
  if (!photoModal) {
    return;
  }
  currentPhotoRecord = photo;
  if (photoModalImage) {
    photoModalImage.src = publicUrl;
  }
  if (photoModalCaption) {
    photoModalCaption.textContent = photo.caption || "사진 설명";
  }
  if (photoModalDate) {
    photoModalDate.textContent = formatDate(photo.created_at);
  }
  renderPhotoLikeState(photo.id);
  setVisibility(photoModal, true);
  document.body.classList.add("modal-open");
  void loadPhotoComments(photo.id);
}

function closePhotoModal() {
  currentPhotoRecord = null;
  if (photoModalImage) {
    photoModalImage.src = "";
  }
  if (photoLikeCount) {
    photoLikeCount.textContent = "좋아요 0";
  }
  setVisibility(photoModal, false);
  document.body.classList.remove("modal-open");
}

function hydratePhotoLikes(rows) {
  photoLikeCounts = new Map();
  photoLikedByMe = new Set();

  rows.forEach((row) => {
    const photoId = String(row.photo_id || "");
    if (!photoId) {
      return;
    }
    photoLikeCounts.set(photoId, Number(photoLikeCounts.get(photoId) || 0) + 1);
    if (authUser?.id && row.user_id === authUser.id) {
      photoLikedByMe.add(photoId);
    }
  });
}

function renderPhotoLikeState(photoId) {
  if (!photoLikeButton || !photoLikeCount) {
    return;
  }

  const likeCount = Number(photoLikeCounts.get(photoId) || 0);
  const liked = photoLikedByMe.has(photoId);
  photoLikeButton.textContent = liked ? "좋아요 취소" : "좋아요";
  photoLikeButton.disabled = !authUser;
  photoLikeCount.textContent = `좋아요 ${likeCount}`;
}

async function handlePhotoLikeToggle() {
  if (!currentPhotoRecord) {
    return;
  }
  if (!authUser) {
    setStatus(photoCommentStatus, photoCommentStatus ? "로그인 후 좋아요를 누를 수 있습니다." : null);
    return;
  }

  const photoId = currentPhotoRecord.id;
  const liked = photoLikedByMe.has(photoId);
  let result;
  if (liked) {
    result = await supabaseClient
      .from("photo_likes")
      .delete()
      .eq("photo_id", photoId)
      .eq("user_id", authUser.id);
  } else {
    result = await supabaseClient
      .from("photo_likes")
      .insert([{ photo_id: photoId, user_id: authUser.id }]);
  }

  if (result.error) {
    setStatus(photoCommentStatus, photoCommentStatus ? `좋아요 처리 실패: ${result.error.message}` : null);
    return;
  }

  const currentCount = Number(photoLikeCounts.get(photoId) || 0);
  if (liked) {
    photoLikedByMe.delete(photoId);
    photoLikeCounts.set(photoId, Math.max(0, currentCount - 1));
  } else {
    photoLikedByMe.add(photoId);
    photoLikeCounts.set(photoId, currentCount + 1);
  }

  renderFilteredPhotos();
  renderPhotoLikeState(photoId);
}
async function loadPhotoComments(photoId) {
  if (!supabaseClient || !photoCommentList) {
    return;
  }

  photoCommentList.innerHTML = '<li class="list-item"><p class="list-meta">댓글을 불러오는 중입니다.</p></li>';
  const result = await supabaseClient
    .from("photo_comments")
    .select("id,author_name,content,created_at")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (result.error) {
    photoCommentList.innerHTML = `<li class="list-item"><p class="list-meta">댓글 로드 실패: ${escapeHtml(result.error.message)}</p></li>`;
    return;
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  if (!rows.length) {
    photoCommentList.innerHTML = '<li class="list-item"><p class="list-meta">아직 댓글이 없습니다.</p></li>';
    return;
  }

  photoCommentList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(row.author_name || "회원")}</span><span class="list-meta">${formatDate(row.created_at)}</span></div><p>${escapeHtml(row.content || "")}</p>`;
    photoCommentList.appendChild(item);
  });
}

async function handlePhotoCommentSubmit(event) {
  event?.preventDefault();
  if (!currentPhotoRecord) {
    return;
  }

  if (supabaseClient) {
    const sessionResult = await supabaseClient.auth.getSession();
    authUser = sessionResult.data?.session?.user || authUser;
  }
  if (authUser) {
    await loadMyProfile();
    renderAuthState();
  }

  if (!authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(photoCommentStatus, photoCommentStatus ? "승인 회원 로그인 후 댓글을 작성할 수 있습니다." : null);
    return;
  }

  const content = String(photoCommentInput?.value || "").trim();
  if (!content) {
    setStatus(photoCommentStatus, photoCommentStatus ? "댓글 내용을 입력해 주세요." : null);
    return;
  }

  setStatus(photoCommentStatus, photoCommentStatus ? "댓글 등록 중..." : null);
  const result = await supabaseClient
    .from("photo_comments")
    .insert([{
      photo_id: currentPhotoRecord.id,
      user_id: authUser.id,
      author_name: authProfile.name || authUser.email,
      content
    }])
    .select("id")
    .single();

  if (result.error) {
    const message = String(result.error.message || "알 수 없는 오류");
    const hint = message.toLowerCase().includes("row-level security")
      ? "승인 상태 또는 댓글 권한을 다시 확인해 주세요."
      : "잠시 후 다시 시도해 주세요.";
    setStatus(photoCommentStatus, photoCommentStatus ? `댓글 등록 실패: ${message} (${hint})` : null);
    return;
  }

  if (photoCommentInput) {
    photoCommentInput.value = "";
  }
  setStatus(photoCommentStatus, photoCommentStatus ? "댓글이 등록되었습니다." : null);
  await loadPhotoComments(currentPhotoRecord.id);
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
    renderBoardLocked("승인 회원 로그인 후 월별 출석, 출석 스트릭, 이달의 러너를 볼 수 있습니다.");
    return;
  }

  const isAdmin = authProfile.role === "admin" && authProfile.approval_status === "approved";
  let members = [];
  let boardSourceLabel = "운영진이 동기화한 Supabase 데이터";

  if (isAdmin) {
    const localMembers = loadLocalAdminMembers(authUser.id);
    if (localMembers.length) {
      members = localMembers;
      boardSourceLabel = "이 브라우저의 최근 운영진 관리 데이터";
    }
  }

  if (!members.length) {
    let membersResult = await supabaseClient
      .from("members")
      .select("id,name,birth_year,total_runs,monthly_runs,fee_status")
      .order("name", { ascending: true });

    if (membersResult.error && String(membersResult.error.message || "").includes("fee_status")) {
      membersResult = await supabaseClient
        .from("members")
        .select("id,name,birth_year,total_runs,monthly_runs")
        .order("name", { ascending: true });
    }

    if (membersResult.error) {
      renderBoardLocked(`활동 보드 로드 실패: ${membersResult.error.message}`);
      return;
    }

    members = Array.isArray(membersResult.data) ? membersResult.data : [];
  }

  const raffleResult = await supabaseClient
    .from("raffle_history")
    .select("target_month_key,threshold,winner_count,winners,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const raffleRecords = Array.isArray(raffleResult.data) ? raffleResult.data : [];
  const rows = members
    .map((member) => ({
      ...member,
      monthRuns: getMonthlyRuns(member, selectedMonth),
      streak: getAttendanceStreakFromMonth(member, selectedMonth)
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
  }) || null;
  const runner = rows.find((member) => member.monthRuns > 0) || null;

  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} 출석 기준입니다. ${boardSourceLabel}를 바탕으로 표시됩니다.`;
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
  renderBoardRaffleHistory(raffleRecords.slice(0, 4));
  await renderMyActivityState(me, selectedMonth, raffleRecords);
}

function renderBoardLocked(message) {
  if (activityLock) {
    activityLock.textContent = message;
  }
  if (activityBoard) {
    activityBoard.classList.add("hidden");
  }
  renderPersonalBoardEmpty();
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
    item.className = "list-item";
    const badge = index === 0 && member.monthRuns > 0
      ? '<span class="status-chip">선두</span>'
      : member.monthRuns >= getMonthThreshold(monthKey)
        ? '<span class="status-chip">추첨 대상</span>'
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

async function renderMyActivityState(me, selectedMonth, raffleRecords) {
  const [photos, comments] = await Promise.all([loadMyPhotos(), loadMyComments()]);
  const wins = Array.isArray(raffleRecords)
    ? raffleRecords.filter((record) => hasRaffleWinner(record, authProfile?.name))
    : [];
  const latestWin = wins[0] || null;
  const feeLabel = getPersonalFeeLabel(me, selectedMonth);
  const previousStreak = getAttendanceStreakFromMonth(me, shiftMonthKey(selectedMonth, -1));
  const currentStreak = getAttendanceStreakFromMonth(me, selectedMonth);
  const raffleThreshold = getMonthThreshold(selectedMonth);
  const raffleLabel = latestWin
    ? `${monthKeyToLabel(latestWin.target_month_key)} 당첨`
    : (me?.monthRuns || 0) >= raffleThreshold
      ? `${monthKeyToLabel(selectedMonth)} 후보`
      : "대기 중";

  if (myFeeStatus) {
    myFeeStatus.textContent = feeLabel;
  }
  if (myRaffleStatus) {
    myRaffleStatus.textContent = raffleLabel;
  }
  if (myStreakChange) {
    myStreakChange.textContent = formatStreakDelta(currentStreak, previousStreak);
  }

  renderBadgeList(buildPersonalBadges({
    me,
    selectedMonth,
    feeLabel,
    latestWin,
    photoCount: photos.length,
    commentCount: comments.length
  }));

  renderSimpleHistory(
    myPhotoHistory,
    photos.map((photo) => ({
      title: photo.caption || "설명 없는 사진",
      meta: formatDate(photo.created_at),
      body: "사진첩 업로드"
    })),
    "아직 사진 업로드 기록이 없습니다."
  );

  renderSimpleHistory(
    myCommentHistory,
    comments.map((comment) => ({
      title: comment.content || "댓글",
      meta: formatDate(comment.created_at),
      body: "사진 댓글"
    })),
    "아직 댓글 기록이 없습니다."
  );

  renderSimpleHistory(
    myRaffleHistory,
    wins.map((record) => ({
      title: `${monthKeyToLabel(record.target_month_key)} 추첨`,
      meta: formatDate(record.created_at),
      body: `${record.threshold}회 기준 / ${record.winner_count}명 추첨`
    })),
    "아직 당첨 이력이 없습니다."
  );
}

function renderPersonalBoardEmpty() {
  if (myFeeStatus) {
    myFeeStatus.textContent = "확인 중";
  }
  if (myRaffleStatus) {
    myRaffleStatus.textContent = "확인 중";
  }
  if (myStreakChange) {
    myStreakChange.textContent = "확인 중";
  }
  renderBadgeList([]);
  renderSimpleHistory(myPhotoHistory, [], "로그인 후 개인 사진 기록이 표시됩니다.");
  renderSimpleHistory(myCommentHistory, [], "로그인 후 내 댓글 기록이 표시됩니다.");
  renderSimpleHistory(myRaffleHistory, [], "로그인 후 내 추첨 기록이 표시됩니다.");
}

async function loadMyPhotos() {
  if (!supabaseClient || !authUser) {
    return [];
  }
  const result = await supabaseClient
    .from("photos")
    .select("id,caption,created_at")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(5);
  return result.error ? [] : (Array.isArray(result.data) ? result.data : []);
}

async function loadMyComments() {
  if (!supabaseClient || !authUser) {
    return [];
  }
  const result = await supabaseClient
    .from("photo_comments")
    .select("id,content,created_at")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(5);
  return result.error ? [] : (Array.isArray(result.data) ? result.data : []);
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

function buildPersonalBadges({ me, selectedMonth, feeLabel, latestWin, photoCount, commentCount }) {
  const badges = [];
  const threshold = getMonthThreshold(selectedMonth);
  if ((me?.monthRuns || 0) >= threshold) {
    badges.push("이번 달 추첨 대상");
  }
  if ((me?.monthRuns || 0) >= threshold + 1) {
    badges.push("꾸준 러너");
  }
  if (String(feeLabel).includes("납부")) {
    badges.push("회비 완료");
  }
  if (photoCount > 0) {
    badges.push("사진 공유");
  }
  if (commentCount > 0) {
    badges.push("응원 댓글러");
  }
  if (latestWin) {
    badges.push("추첨 당첨");
  }
  return badges;
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
    if (getMonthlyRuns(member, key) <= 0) {
      break;
    }
    streak += 1;
  }
  return streak;
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
  return "스트릭 재시작";
}

function hasRaffleWinner(record, name) {
  if (!record || !name || !Array.isArray(record.winners)) {
    return false;
  }
  const normalized = normalizeName(name);
  return record.winners.some((winner) => normalizeName(winner?.name) === normalized);
}

function getMonthThreshold(monthKey) {
  const parts = String(monthKey || "").split("-");
  const month = Number(parts[1] || 0);
  return [12, 1, 2].includes(month) ? 4 : 5;
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


























