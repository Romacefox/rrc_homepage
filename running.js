const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";

let runningClient = null;
let runningUser = null;
let runningProfile = null;

const yearNode = document.getElementById("year");
const runningAuthStatus = document.getElementById("running-auth-status");
const runningRoleStatus = document.getElementById("running-role-status");
const runningComposeLock = document.getElementById("running-compose-lock");
const runningPostForm = document.getElementById("running-post-form");
const runningPostCategory = document.getElementById("running-post-category");
const runningPostTitle = document.getElementById("running-post-title");
const runningPostSummary = document.getElementById("running-post-summary");
const runningPostContent = document.getElementById("running-post-content");
const runningPostSubmit = document.getElementById("running-post-submit");
const runningPostStatus = document.getElementById("running-post-status");
const runningFeaturedList = document.getElementById("running-featured-list");
const runningPublicList = document.getElementById("running-public-list");
const runningAdminPanel = document.getElementById("running-admin-panel");
const runningAdminRefresh = document.getElementById("running-admin-refresh");
const runningAdminList = document.getElementById("running-admin-list");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}
initRunningHub();

function initRunningHub() {
  if (!window.supabase || !window.supabase.createClient) {
    setRunningText(runningAuthStatus, "Supabase 라이브러리를 불러오지 못했습니다.");
    return;
  }

  runningClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  runningPostSubmit?.addEventListener("click", submitRunningPost);
  runningAdminRefresh?.addEventListener("click", loadRunningAdminList);

  runningClient.auth.onAuthStateChange(async (_event, session) => {
    runningUser = session?.user || null;
    await loadRunningProfile();
    renderRunningAuthState();
    await loadRunningHub();
  });

  runningClient.auth.getSession().then(async ({ data }) => {
    runningUser = data?.session?.user || null;
    await loadRunningProfile();
    renderRunningAuthState();
    await loadRunningHub();
  });
}

async function loadRunningProfile() {
  runningProfile = null;
  if (!runningClient || !runningUser) {
    return;
  }

  const result = await runningClient
    .from("member_profiles")
    .select("user_id,name,birth_year,approval_status,role")
    .eq("user_id", runningUser.id)
    .maybeSingle();

  if (!result.error) {
    runningProfile = result.data;
  }
}

function renderRunningAuthState() {
  if (!runningUser) {
    setRunningText(runningAuthStatus, "로그인하지 않은 상태입니다.");
    setRunningText(runningRoleStatus, "승인 회원 로그인 후 러닝 허브 제안을 남길 수 있습니다.");
    setRunningText(runningComposeLock, "승인 회원 로그인 후 글 등록이 열립니다.");
    runningPostForm?.classList.add("hidden");
    runningAdminPanel?.classList.add("hidden");
    return;
  }

  const isApproved = runningProfile?.approval_status === "approved";
  const isAdmin = isApproved && runningProfile?.role === "admin";
  setRunningText(runningAuthStatus, `로그인됨: ${runningUser.email}`);
  setRunningText(runningRoleStatus, `상태: ${statusLabel(runningProfile?.approval_status)} / 권한: ${runningProfile?.role || "member"}`);

  if (isApproved) {
    setRunningText(runningComposeLock, "승인 회원 제안글은 운영진 승인 후 공개됩니다.");
    runningPostForm?.classList.remove("hidden");
  } else {
    setRunningText(runningComposeLock, "승인된 회원만 러닝 허브 글을 등록할 수 있습니다.");
    runningPostForm?.classList.add("hidden");
  }

  if (isAdmin) {
    runningAdminPanel?.classList.remove("hidden");
  } else {
    runningAdminPanel?.classList.add("hidden");
  }
}

async function loadRunningHub() {
  await loadRunningPublicPosts();
  await loadRunningAdminList();
}

async function loadRunningPublicPosts() {
  if (!runningClient) {
    return;
  }

  const result = await runningClient
    .from("running_hub_posts")
    .select("id,author_name,category,title,summary,content,is_featured,created_at")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = Array.isArray(result.data) ? result.data : [];
  renderRunningFeatured(rows.filter((row) => row.is_featured).slice(0, 4));
  renderRunningPublic(rows);
}

async function loadRunningAdminList() {
  if (!runningClient || !runningProfile || runningProfile.role !== "admin" || runningProfile.approval_status !== "approved") {
    return;
  }

  if (runningAdminList) {
    runningAdminList.innerHTML = '<li class="list-item"><p class="list-meta">불러오는 중...</p></li>';
  }

  const result = await runningClient
    .from("running_hub_posts")
    .select("id,author_name,category,title,summary,content,status,is_featured,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (result.error) {
    runningAdminList.innerHTML = `<li class="list-item"><p class="list-meta">로드 실패: ${escapeHtml(result.error.message)}</p></li>`;
    return;
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  if (!rows.length) {
    runningAdminList.innerHTML = '<li class="list-item"><p class="list-meta">등록된 허브 글이 없습니다.</p></li>';
    return;
  }

  runningAdminList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(row.title)}</span><span class="list-meta">${formatDate(row.created_at)}</span></div><p class="list-meta">${categoryLabel(row.category)} / ${escapeHtml(row.author_name || "회원")} / ${escapeHtml(row.status || "pending")}${row.is_featured ? " / 추천글" : ""}</p><p>${escapeHtml(row.summary || row.content || "")}</p>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("승인", () => updateRunningPost(row.id, { status: "approved" })));
    actions.appendChild(buildTinyButton("반려", () => updateRunningPost(row.id, { status: "rejected", is_featured: false })));
    actions.appendChild(buildTinyButton(row.is_featured ? "추천 해제" : "추천글", () => updateRunningPost(row.id, { status: "approved", is_featured: !row.is_featured })));
    actions.appendChild(buildTinyButton("삭제", () => deleteRunningPost(row.id)));
    item.appendChild(actions);
    runningAdminList.appendChild(item);
  });
}

async function submitRunningPost() {
  if (!runningUser || !runningProfile || runningProfile.approval_status !== "approved") {
    setRunningText(runningPostStatus, "승인 회원만 글을 등록할 수 있습니다.");
    return;
  }

  const payload = {
    author_user_id: runningUser.id,
    author_name: runningProfile.name || "회원",
    category: String(runningPostCategory?.value || "tip"),
    title: String(runningPostTitle?.value || "").trim(),
    summary: String(runningPostSummary?.value || "").trim(),
    content: String(runningPostContent?.value || "").trim(),
    status: runningProfile.role === "admin" ? "approved" : "pending",
    is_featured: false
  };

  if (!payload.title || !payload.content) {
    setRunningText(runningPostStatus, "제목과 본문을 입력해 주세요.");
    return;
  }

  const result = await runningClient.from("running_hub_posts").insert(payload);
  if (result.error) {
    setRunningText(runningPostStatus, `등록 실패: ${result.error.message}`);
    return;
  }

  if (runningPostTitle) runningPostTitle.value = "";
  if (runningPostSummary) runningPostSummary.value = "";
  if (runningPostContent) runningPostContent.value = "";
  setRunningText(runningPostStatus, runningProfile.role === "admin" ? "글이 바로 공개되었습니다." : "제안이 등록되었습니다. 운영진 승인 후 공개됩니다.");
  await loadRunningHub();
}

async function updateRunningPost(id, patch) {
  const result = await runningClient.from("running_hub_posts").update(patch).eq("id", id);
  if (result.error) {
    alert(`허브 글 수정 실패: ${result.error.message}`);
    return;
  }
  await loadRunningHub();
}

async function deleteRunningPost(id) {
  const confirmed = window.confirm("이 허브 글을 삭제할까요?");
  if (!confirmed) {
    return;
  }
  const result = await runningClient.from("running_hub_posts").delete().eq("id", id);
  if (result.error) {
    alert(`허브 글 삭제 실패: ${result.error.message}`);
    return;
  }
  await loadRunningHub();
}

function renderRunningFeatured(rows) {
  if (!runningFeaturedList) {
    return;
  }
  runningFeaturedList.innerHTML = "";
  if (!rows.length) {
    runningFeaturedList.innerHTML = '<article class="card"><h3>추천글 준비 중</h3><p class="list-meta">운영진이 추천 루트와 팁을 정리하고 있습니다.</p></article>';
    return;
  }

  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${escapeHtml(row.title)}</h3><p class="list-meta">${categoryLabel(row.category)} · ${escapeHtml(row.author_name || "회원")}</p><p>${escapeHtml(row.summary || row.content || "")}</p>`;
    runningFeaturedList.appendChild(card);
  });
}

function renderRunningPublic(rows) {
  if (!runningPublicList) {
    return;
  }
  runningPublicList.innerHTML = "";
  if (!rows.length) {
    runningPublicList.innerHTML = '<div class="panel"><p class="list-meta">공개된 러닝 허브 글이 아직 없습니다.</p></div>';
    return;
  }

  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "panel running-post-item";
    article.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(row.title)}</span><span class="list-meta">${formatDate(row.created_at)}</span></div><p class="list-meta">${categoryLabel(row.category)} · ${escapeHtml(row.author_name || "회원")}${row.is_featured ? " · 추천글" : ""}</p><p>${escapeHtml(row.summary || "")}</p><div class="running-post-body">${escapeHtml(row.content).replaceAll("\n", "<br />")}</div>`;
    runningPublicList.appendChild(article);
  });
}

function setRunningText(node, text) {
  if (node) {
    node.textContent = text;
  }
}

function statusLabel(status) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "pending") return "대기";
  return "미확인";
}

function categoryLabel(category) {
  if (category === "route") return "추천 루트";
  if (category === "tip") return "러닝 팁";
  if (category === "checklist") return "체크리스트";
  if (category === "story") return "러닝 후기";
  return "허브 글";
}

function formatDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "-";
  }
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function buildTinyButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn ghost tiny";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', '&quot;')
    .replaceAll("'", "&#39;");
}
