const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";
const PHOTO_BUCKET = "rrc-photos";
const PENDING_SIGNUP_PREFIX = "rrc-pending-signup:";

let supabaseClient = null;
let authUser = null;
let authProfile = null;
let photoRecords = [];
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
const memberNavLinks = document.querySelectorAll("[data-member-nav]");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");
const photoModal = document.getElementById("photo-modal");
const photoModalImage = document.getElementById("photo-modal-image");
const photoModalCaption = document.getElementById("photo-modal-caption");
const photoModalDate = document.getElementById("photo-modal-date");
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

function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setStatus(loginStatus, "?¤ì • ?„ìš”: auth.js ?ë‹¨ SUPABASE ê°’ì„ ?…ë ¥?˜ì„¸??");
    setStatus(signupStatus, "?¤ì • ?„ìš”: auth.js ?ë‹¨ SUPABASE ê°’ì„ ?…ë ¥?˜ì„¸??");
    disablePhotoUpload();
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    setStatus(loginStatus, "Supabase ?¼ì´ë¸ŒëŸ¬ë¦¬ë? ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??");
    setStatus(signupStatus, "Supabase ?¼ì´ë¸ŒëŸ¬ë¦¬ë? ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??");
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
  photoModalClose?.addEventListener("click", closePhotoModal);
  photoModalBackdrop?.addEventListener("click", closePhotoModal);
  photoCommentForm?.addEventListener("submit", handlePhotoCommentSubmit);
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
    setStatus(signupStatus, "?´ë©”??ë¹„ë?ë²ˆí˜¸/?´ë¦„/ì¶œìƒ?°ë„???„ìˆ˜?…ë‹ˆ??");
    return;
  }
  if (payload.birthYear < 1989 || payload.birthYear > 2000) {
    setStatus(signupStatus, "ì¶œìƒ?°ë„??1989~2000ë§?ê°€?¥í•©?ˆë‹¤.");
    return;
  }
  if (!payload.agreed) {
    setStatus(signupStatus, "ê°œì¸?•ë³´ ?˜ì§‘ ?™ì˜ê°€ ?„ìš”?©ë‹ˆ??");
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
    setStatus(signupStatus, `ê°€???¤íŒ¨: ${signUpResult.error.message}`);
    return;
  }

  setStatus(signupStatus, "ê°€??? ì²­ ?„ë£Œ. ?´ë©”???¸ì¦ ??ë¡œê·¸?¸í•˜ë©??„ë¡œ?„ì´ ?ë™ ?€?¥ë˜ê³??´ì˜ì§??¹ì¸??ê¸°ë‹¤ë¦¬ê²Œ ?©ë‹ˆ??");
}

async function handleLogin(event) {
  event?.preventDefault();

  const email = String(loginEmailInput?.value || "").trim();
  const password = String(loginPasswordInput?.value || "").trim();

  if (!email || !password) {
    setStatus(loginStatus, "?´ë©”??ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??");
    return;
  }

  if (loginSubmitButton) {
    loginSubmitButton.disabled = true;
  }
  setStatus(loginStatus, "ë¡œê·¸??ì¤?..");

  try {
    const loginResult = await supabaseClient.auth.signInWithPassword({ email, password });
    if (loginResult.error) {
      setStatus(loginStatus, `ë¡œê·¸???¤íŒ¨: ${loginResult.error.message}`);
      return;
    }

    const signedInUser = loginResult.data?.session?.user || loginResult.data?.user || null;
    await hydrateAuthState(signedInUser);

    if (!authUser) {
      setStatus(loginStatus, "ë¡œê·¸?¸ì? ?˜ì—ˆì§€ë§??¸ì…˜???•ì¸?˜ì? ëª»í–ˆ?µë‹ˆ?? ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??");
      return;
    }

    setStatus(loginStatus, `ë¡œê·¸?¸ë¨: ${authUser.email}`);
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
  renderBoardLocked("?¹ì¸???Œì› ë¡œê·¸?????”ë³„ ì¶œì„, ì¶œì„ ?¤íŠ¸ë¦? ?´ë‹¬???¬ë„ˆë¥?ë³????ˆìŠµ?ˆë‹¤.");
  setStatus(loginStatus, loginStatus ? "ë¡œê·¸?„ì›ƒ ?„ë£Œ" : null);
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
    setStatus(loginStatus, loginStatus ? "ë¡œê·¸???„ìš”" : null);
    setStatus(loginApprovalStatus, loginApprovalStatus ? "?¹ì¸ ?íƒœ: ë¡œê·¸???„ìš”" : null);
    setStatus(galleryAuthStatus, galleryAuthStatus ? "ë¡œê·¸???„ìš”" : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "?¹ì¸ ?íƒœ ?•ì¸ ???…ë¡œ?œê? ?´ë¦½?ˆë‹¤." : null);
    disablePhotoUpload();
    updatePhotoCommentComposer(false);
    return;
  }

  updateLoginLayout(true);
  updateSharedNavigation(true, isAdmin);
  setVisibility(galleryGuestActions, false);
  setVisibility(galleryMemberActions, true);
  const roleSuffix = isAdmin ? " / ?´ì˜ì§?ê¶Œí•œ ?¬í•¨" : "";
  setStatus(loginStatus, loginStatus ? `ë¡œê·¸?¸ë¨: ${authUser.email}` : null);
  setStatus(galleryAuthStatus, galleryAuthStatus ? `ë¡œê·¸?¸ë¨: ${authUser.email}` : null);

  if (!authProfile) {
    setStatus(loginApprovalStatus, loginApprovalStatus ? "?¹ì¸ ?íƒœ: ?„ë¡œ??ë¯¸ë“±ë¡??´ì˜ì§?ë¬¸ì˜)" : null);
    setStatus(galleryApprovalStatus, galleryApprovalStatus ? "?¹ì¸ ?íƒœ: ?„ë¡œ??ë¯¸ë“±ë¡??´ì˜ì§?ë¬¸ì˜)" : null);
    disablePhotoUpload();
    updatePhotoCommentComposer(false);
    return;
  }

  const label = `?¹ì¸ ?íƒœ: ${statusLabel(authProfile.approval_status)}${roleSuffix}`;
  setStatus(loginApprovalStatus, loginApprovalStatus ? label : null);
  setStatus(galleryApprovalStatus, galleryApprovalStatus ? label : null);

  if (isApproved) {
    enablePhotoUpload();
    updatePhotoCommentComposer(true);
    return;
  }

  disablePhotoUpload("?´ì˜ì§??¹ì¸ ???¬ì§„ ?…ë¡œ?œê? ê°€?¥í•©?ˆë‹¤.");
  updatePhotoCommentComposer(false);
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
}

function updateLoginLayout(isLoggedIn) {
  setVisibility(loginForm, !isLoggedIn);
  setVisibility(loginGuestActions, !isLoggedIn);
  setVisibility(loginMemberActions, isLoggedIn);
  if (loginPanelTitle) {
    loginPanelTitle.textContent = isLoggedIn ? "³» È°µ¿" : "·Î±×ÀÎ";
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
      ? "?¹ì¸ ?Œì›?€ ?¬ì§„???“ê????¨ê¸¸ ???ˆìŠµ?ˆë‹¤."
      : "?¹ì¸ ?Œì› ë¡œê·¸?????“ê? ?‘ì„±???´ë¦½?ˆë‹¤.";
  }
}

function disablePhotoUpload(message = "ë¡œê·¸?¸í•œ ?Œì›ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.") {
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
  setStatus(photoStatus, photoStatus ? "?¹ì¸ ?„ë£Œ. ?¬ì§„???…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤." : null);
}

async function handlePhotoUpload() {
  if (!authUser || !authProfile) {
    setStatus(photoStatus, photoStatus ? "ë¡œê·¸?¸í•œ ?Œì›ë§??…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤." : null);
    return;
  }
  if (authProfile.approval_status !== "approved") {
    setStatus(photoStatus, photoStatus ? "?´ì˜ì§??¹ì¸ ???¬ì§„ ?…ë¡œ?œê? ê°€?¥í•©?ˆë‹¤." : null);
    return;
  }

  const file = photoFileInput?.files?.[0];
  if (!file) {
    setStatus(photoStatus, photoStatus ? "?…ë¡œ?œí•  ?¬ì§„ ?Œì¼??? íƒ?˜ì„¸??" : null);
    return;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${authUser.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  setStatus(photoStatus, photoStatus ? "?…ë¡œ??ì¤?.." : null);

  const uploadResult = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type
  });
  if (uploadResult.error) {
    setStatus(photoStatus, photoStatus ? `?…ë¡œ???¤íŒ¨: ${uploadResult.error.message}` : null);
    return;
  }

  const caption = String(photoCaptionInput?.value || "").trim();
  const insertResult = await supabaseClient.from("photos").insert({
    user_id: authUser.id,
    file_path: path,
    caption
  });

  if (insertResult.error) {
    setStatus(photoStatus, photoStatus ? `ë©”í? ?€???¤íŒ¨: ${insertResult.error.message}` : null);
    return;
  }

  if (photoFileInput) {
    photoFileInput.value = "";
  }
  if (photoCaptionInput) {
    photoCaptionInput.value = "";
  }
  setStatus(photoStatus, photoStatus ? "?…ë¡œ???„ë£Œ" : null);
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
    setStatus(photoStatus, photoStatus ? `?¬ì§„ ëª©ë¡ ë¡œë“œ ?¤íŒ¨: ${photosResult.error.message}` : null);
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
  const options = ['<option value="all">?„ì²´ ??/option>'];
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
    photoGrid.innerHTML = '<p class="list-meta">? íƒ???”ì˜ ?¬ì§„???†ìŠµ?ˆë‹¤.</p>';
    return;
  }

  filtered.forEach((photo) => {
    const publicUrl = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(photo.file_path).data.publicUrl;
    const card = document.createElement("article");
    card.className = "photo-item";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <img src="${publicUrl}" alt="RRC photo" loading="lazy" />
      <div class="photo-meta">
        <div>${escapeHtml(photo.caption || "¹«¼³¸í")}</div>
        <div>${formatDate(photo.created_at)}</div>
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
    photoModalCaption.textContent = photo.caption || "?¬ì§„ ?¤ëª…";
  }
  if (photoModalDate) {
    photoModalDate.textContent = formatDate(photo.created_at);
  }
  setVisibility(photoModal, true);
  document.body.classList.add("modal-open");
  void loadPhotoComments(photo.id);
}

function closePhotoModal() {
  currentPhotoRecord = null;
  if (photoModalImage) {
    photoModalImage.src = "";
  }
  setVisibility(photoModal, false);
  document.body.classList.remove("modal-open");
}

async function loadPhotoComments(photoId) {
  if (!supabaseClient || !photoCommentList) {
    return;
  }

  photoCommentList.innerHTML = '<li class="list-item"><p class="list-meta">?“ê???ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤.</p></li>';
  const result = await supabaseClient
    .from("photo_comments")
    .select("id,author_name,content,created_at")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (result.error) {
    photoCommentList.innerHTML = `<li class="list-item"><p class="list-meta">?“ê? ë¡œë“œ ?¤íŒ¨: ${escapeHtml(result.error.message)}</p></li>`;
    return;
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  if (!rows.length) {
    photoCommentList.innerHTML = '<li class="list-item"><p class="list-meta">?„ì§ ?“ê????†ìŠµ?ˆë‹¤.</p></li>';
    return;
  }

  photoCommentList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(row.author_name || "?Œì›")}</span><span class="list-meta">${formatDate(row.created_at)}</span></div><p>${escapeHtml(row.content || "")}</p>`;
    photoCommentList.appendChild(item);
  });
}

async function handlePhotoCommentSubmit(event) {
  event?.preventDefault();
  if (!currentPhotoRecord) {
    return;
  }
  if (!authUser || !authProfile || authProfile.approval_status !== "approved") {
    setStatus(photoCommentStatus, photoCommentStatus ? "?¹ì¸ ?Œì› ë¡œê·¸?????“ê????‘ì„±?????ˆìŠµ?ˆë‹¤." : null);
    return;
  }

  const content = String(photoCommentInput?.value || "").trim();
  if (!content) {
    setStatus(photoCommentStatus, photoCommentStatus ? "?“ê? ?´ìš©???…ë ¥??ì£¼ì„¸??" : null);
    return;
  }

  setStatus(photoCommentStatus, photoCommentStatus ? "?“ê? ?€??ì¤?.." : null);
  const result = await supabaseClient.from("photo_comments").insert({
    photo_id: currentPhotoRecord.id,
    user_id: authUser.id,
    author_name: authProfile.name || authUser.email,
    content
  });

  if (result.error) {
    setStatus(photoCommentStatus, photoCommentStatus ? `?“ê? ?€???¤íŒ¨: ${result.error.message}` : null);
    return;
  }

  if (photoCommentInput) {
    photoCommentInput.value = "";
  }
  setStatus(photoCommentStatus, photoCommentStatus ? "?“ê????±ë¡?˜ì—ˆ?µë‹ˆ??" : null);
  await loadPhotoComments(currentPhotoRecord.id);
}

async function loadActivityBoard() {
  if (!supabaseClient || !activityBoard || !activityLock) {
    return;
  }
  const selectedMonth = activityMonthSelect?.value || currentMonthKey();
  if (runnerMonthLabel) {
    runnerMonthLabel.textContent = `${monthKeyToLabel(selectedMonth)} ê¸°ì?`;
  }

  if (!authUser || !authProfile || authProfile.approval_status !== "approved") {
    renderBoardLocked("?¹ì¸???Œì› ë¡œê·¸?????”ë³„ ì¶œì„, ì¶œì„ ?¤íŠ¸ë¦? ?´ë‹¬???¬ë„ˆë¥?ë³????ˆìŠµ?ˆë‹¤.");
    return;
  }

  const membersResult = await supabaseClient
    .from("members")
    .select("id,name,birth_year,total_runs,monthly_runs")
    .order("name", { ascending: true });

  if (membersResult.error) {
    renderBoardLocked(`?œë™ ë³´ë“œ ë¡œë“œ ?¤íŒ¨: ${membersResult.error.message}`);
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

  activityLock.textContent = `${monthKeyToLabel(selectedMonth)} ì¶œì„ ê¸°ì??…ë‹ˆ?? ?´ì˜ì§„ì´ ?™ê¸°?”í•œ ?°ì´?°ë¡œ ?œì‹œ?©ë‹ˆ??`;
  activityBoard.classList.remove("hidden");

  if (myMonthRuns) {
    myMonthRuns.textContent = `${me?.monthRuns || 0}È¸`;
  }
  if (myTotalRuns) {
    myTotalRuns.textContent = `${Number(me?.total_runs || 0)}È¸`;
  }
  if (myStreak) {
    myStreak.textContent = `${me?.streak || 0}°³¿ù`;
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
    attendanceBoard.innerHTML = '<li class="list-item"><p class="list-meta">?™ê¸°?”ëœ ?Œì› ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</p></li>';
    return;
  }

  rows.forEach((member, index) => {
    const item = document.createElement("li");
    item.className = "list-item";
    const badge = index === 0 && member.monthRuns > 0
      ? '<span class="status-chip">? ë‘</span>'
      : member.monthRuns >= 5
        ? '<span class="status-chip">ì¶”ì²¨?€??/span>'
        : "";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${index + 1}. ${escapeHtml(member.name || "?´ë¦„?†ìŒ")}${badge}</span>
        <span class="list-meta">${monthKeyToLabel(monthKey)} ${member.monthRuns}??/span>
      </div>
      <p class="list-meta">?„ì  ${Number(member.total_runs || 0)}??/ ì¶œì„ ?¤íŠ¸ë¦?${member.streak}ê°œì›”</p>
    `;
    attendanceBoard.appendChild(item);
  });
}

function renderRunnerCard(runner, monthKey) {
  if (!runnerCard) {
    return;
  }
  if (!runner || runner.monthRuns === 0) {
    runnerCard.innerHTML = `<p class="list-meta">${monthKeyToLabel(monthKey)}?ëŠ” ?„ì§ ì¶œì„ ê¸°ë¡???†ìŠµ?ˆë‹¤.</p>`;
    return;
  }

  runnerCard.innerHTML = `
    <p class="list-meta">${monthKeyToLabel(monthKey)} ìµœë‹¤ ì¶œì„</p>
    <h3 style="margin:0.2rem 0 0.4rem;">${escapeHtml(runner.name || "?´ë¦„?†ìŒ")}</h3>
    <p>${runner.monthRuns}??ì¶œì„ / ?„ì  ${Number(runner.total_runs || 0)}??/p>
    <p class="list-meta">ì¶œì„ ?¤íŠ¸ë¦?${runner.streak}ê°œì›”</p>
  `;
}

function renderBoardRaffleHistory(records) {
  if (!boardRaffleHistory) {
    return;
  }
  boardRaffleHistory.innerHTML = "";
  if (!records.length) {
    boardRaffleHistory.innerHTML = '<li class="list-item"><p class="list-meta">ì¶”ì²¨ ê¸°ë¡???†ìŠµ?ˆë‹¤.</p></li>';
    return;
  }

  records.forEach((record) => {
    const winners = Array.isArray(record.winners) ? record.winners.map((winner) => winner.name).join(", ") : "";
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-top">
        <span class="list-title">${monthKeyToLabel(record.target_month_key)} ì¶”ì²¨</span>
        <span class="list-meta">${formatDate(record.created_at)}</span>
      </div>
      <p class="list-meta">ê¸°ì? ${record.threshold}??/ ${record.winner_count}ëª?ì¶”ì²¨</p>
      <p>${escapeHtml(winners || "?¹ì²¨???†ìŒ")}</p>
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
  return `${year}³â ${month}¿ù`;
}

function normalizeName(name) {
  return String(name || "").replaceAll(" ", "").toLowerCase();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function statusLabel(status) {
  if (status === "approved") {
    return "½ÂÀÎ";
  }
  if (status === "rejected") {
    return "¹İ·Á";
  }
  return "´ë±â";
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





