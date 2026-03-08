const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const PHOTO_BUCKET = "rrc-photos";

let supabaseClient = null;
let authUser = null;

const yearNode = document.getElementById("year");
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

yearNode.textContent = new Date().getFullYear();
init();

function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    authStatus.textContent = "설정 필요: auth.js 상단 SUPABASE 값을 입력하세요.";
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    authStatus.textContent = "Supabase 라이브러리를 불러오지 못했습니다.";
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

  authStatus.textContent = "회원가입 완료. 이메일 인증이 설정되어 있으면 메일 확인 후 로그인하세요.";
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
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("photos")
    .select("id,file_path,caption,created_at")
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
