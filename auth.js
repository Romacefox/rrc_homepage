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

  authSignupButton.addEventListener("click", handleSignup);
  authLoginButton.addEventListener("click", handleLogin);
  authLogoutButton.addEventListener("click", handleLogout);
  photoUploadButton.addEventListener("click", handlePhotoUpload);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    authUser = session?.user || null;
    await loadMyProfile();
    renderAuthState();
    loadPhotos();
  });

  supabaseClient.auth.getSession().then(async ({ data }) => {
    authUser = data?.session?.user || null;
    await loadMyProfile();
    renderAuthState();
    loadPhotos();
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

  authStatus.textContent = "가입 신청 완료. 운영진 승인 후 사진 업로드가 가능합니다.";
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

