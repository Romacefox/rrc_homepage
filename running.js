const SUPABASE_URL = "https://aqpszgycsfpxtlsuaqrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C20xXZZRWdjmkzGneCcpjw_mrRnXucq";

let runningClient = null;
let runningUser = null;
let runningProfile = null;
let runningPosts = [];
let runningLikeCounts = new Map();
let runningLikedByMe = new Set();

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
const runningFilter = document.getElementById("running-filter");
const memberNavLinks = document.querySelectorAll("[data-member-nav]");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");
const authEntryLinks = document.querySelectorAll("[data-auth-entry]");
const runningGuestActions = document.getElementById("running-guest-actions");
const runningMemberActions = document.getElementById("running-member-actions");
const runningComposeJump = document.getElementById("running-compose-jump");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

initRunningHub();

function syncRunningAuthFromSharedState() {
  const sharedState = window.__RRC_AUTH_STATE || null;
  if (!sharedState) {
    return false;
  }
  runningUser = sharedState.user || runningUser || null;
  runningProfile = sharedState.profile || runningProfile || null;
  return Boolean(runningUser || runningProfile);
}


function initRunningHub() {
  if (!window.supabase || !window.supabase.createClient) {
    setRunningText(runningAuthStatus, "Supabase 라이브러리를 불러오지 못했습니다.");
    return;
  }

  runningClient = window.__RRC_SUPABASE_CLIENT || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "rrc-auth"
    }
  });

  runningPostSubmit?.addEventListener("click", submitRunningPost);
  runningAdminRefresh?.addEventListener("click", loadRunningAdminList);
  runningFilter?.addEventListener("change", renderRunningPublic);

  window.addEventListener("rrc-auth-state", async () => {
    syncRunningAuthFromSharedState();
    await refreshRunningSession();
  });

  runningClient.auth.onAuthStateChange(async (_event, session) => {
    runningUser = session?.user || null;
    await refreshRunningSession();
  });

  syncRunningAuthFromSharedState();
  runningClient.auth.getSession().then(async ({ data }) => {
    await refreshRunningSession();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !runningClient) {
      return;
    }
    syncRunningAuthFromSharedState();
    const { data } = await runningClient.auth.getSession();
    runningUser = data?.session?.user || readStoredRunningUser() || null;
    await refreshRunningSession();
  });
}

async function refreshRunningSession() {
  syncRunningAuthFromSharedState();
  try {
    await loadRunningProfile();
    renderRunningAuthState();
    await loadRunningHub();
  } catch (error) {
    setRunningText(runningAuthStatus, "러닝 허브 상태를 새로 불러오지 못했습니다.");
    setRunningText(runningRoleStatus, String(error?.message || error || "잠시 후 다시 시도해 주세요."));
    renderRunningFeatured([]);
    if (runningPublicList) {
      runningPublicList.innerHTML = '<div class="panel running-empty-state"><p class="list-meta">러닝 허브를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p></div>';
    }
  }
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
    updateSharedNavigation(false, false);
    setVisibility(runningGuestActions, true);
    setVisibility(runningMemberActions, false);
    setVisibility(runningComposeJump, true);
    setRunningText(runningAuthStatus, "로그인하면 러닝 허브 글을 더 편하게 보고 글도 쓸 수 있습니다.");
    setRunningText(runningRoleStatus, "승인 회원은 루트, 팁, 체크리스트, 후기를 작성할 수 있습니다.");
    setRunningText(runningComposeLock, "회원가입 후 운영진 승인까지 완료되면 글쓰기가 열립니다.");
    if (runningComposeJump) {
      runningComposeJump.textContent = "로그인하고 글쓰기";
      runningComposeJump.setAttribute("href", "login.html?next=running&compose=1");
    }
    runningPostForm?.classList.add("hidden");
    runningAdminPanel?.classList.add("hidden");
    runningAdminPanel && (runningAdminPanel.hidden = true);
    return;
  }

  const approvalStatus = runningProfile?.approval_status || "pending";
  const isApproved = approvalStatus === "approved";
  const isAdmin = isApproved && runningProfile?.role === "admin";

  updateSharedNavigation(true, isAdmin);
  setVisibility(runningGuestActions, false);
  setVisibility(runningMemberActions, true);
  setVisibility(runningComposeJump, true);

  setRunningText(runningAuthStatus, `로그인됨: ${runningUser.email}`);
  setRunningText(runningRoleStatus, `승인 상태: ${statusLabel(approvalStatus)} / 권한: ${runningRoleLabel(runningProfile?.role, approvalStatus)}`);

  if (isApproved) {
    setRunningText(runningComposeLock, "승인 회원은 루트, 팁, 체크리스트, 후기를 자유롭게 작성할 수 있습니다.");
    if (runningComposeJump) {
      runningComposeJump.textContent = "글쓰기";
      runningComposeJump.setAttribute("href", "#running-compose-section");
    }
    runningPostForm?.classList.remove("hidden");
  } else {
    setRunningText(runningComposeLock, "현재는 승인 대기 중입니다. 승인 완료 후 글쓰기가 열립니다.");
    if (runningComposeJump) {
      runningComposeJump.textContent = "승인 상태 확인하기";
      runningComposeJump.setAttribute("href", "login.html?next=running&compose=1");
    }
    runningPostForm?.classList.add("hidden");
  }

  runningAdminPanel?.classList.toggle("hidden", !isAdmin);
  if (runningAdminPanel) {
    runningAdminPanel.hidden = !isAdmin;
  }
}

function updateSharedNavigation(memberVisible, adminVisible) {
  memberNavLinks.forEach((node) => setVisibility(node, memberVisible));
  adminNavLinks.forEach((node) => setVisibility(node, adminVisible));
  authEntryLinks.forEach((node) => setVisibility(node, !memberVisible));
}

function readStoredRunningUser() {
  try {
    const raw = localStorage.getItem("rrc-auth");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed?.user ?? parsed?.currentSession?.user ?? parsed?.session?.user ?? null;
  } catch (_error) {
    return null;
  }
}


async function resolveRunningUser() {
  if (!runningClient) {
    return null;
  }

  try {
    const sessionResult = await runningClient.auth.getSession();
    const sessionUser = sessionResult.data?.session?.user || null;
    if (sessionUser) {
      return sessionUser;
    }
  } catch (_error) {
    // Ignore and continue to fallback checks.
  }

  try {
    const userResult = await runningClient.auth.getUser();
    const directUser = userResult.data?.user || null;
    if (directUser) {
      return directUser;
    }
  } catch (_error) {
    // Ignore and continue to local fallback.
  }

  return readStoredRunningUser() || null;
}
function setVisibility(node, visible) {
  if (!node) {
    return;
  }
  node.classList.toggle("hidden", !visible);
  node.hidden = !visible;
}

async function loadRunningHub() {
  await loadRunningPublicPosts();
  await loadRunningAdminList();
}

async function loadRunningPublicPosts() {
  if (!runningClient) {
    return;
  }

  if (runningPublicList) {
    runningPublicList.innerHTML = '<div class="panel running-empty-state"><p class="list-meta">러닝 허브 글을 불러오는 중입니다.</p></div>';
  }

  const query = runningClient
    .from("running_hub_posts")
    .select("id,author_name,category,title,summary,content,status,is_featured,created_at")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const postsResult = await query.or(runningProfile?.role === "admin" && runningProfile?.approval_status === "approved"
    ? "status.eq.approved,status.eq.pending,status.eq.rejected"
    : "status.eq.approved");

  if (postsResult.error) {
    runningPosts = [];
    renderRunningFeatured([]);
    if (runningPublicList) {
      const rawMessage = String(postsResult.error.message || "알 수 없는 오류");
      const friendlyMessage = rawMessage.includes("running_hub_posts")
        ? "러닝 허브 테이블이 아직 Supabase에 반영되지 않았습니다. SQL 패치를 먼저 실행해 주세요."
        : `러닝 허브 로드 실패: ${escapeHtml(rawMessage)}`;
      runningPublicList.innerHTML = `<div class="panel running-empty-state"><p class="list-meta">${friendlyMessage}</p></div>`;
    }
    return;
  }

  runningPosts = Array.isArray(postsResult.data) ? postsResult.data : [];
  await loadRunningLikes();
  renderRunningFeatured(runningPosts.filter((row) => row.is_featured && row.status === "approved").slice(0, 4));
  renderRunningPublic();
}

async function loadRunningLikes() {
  if (!runningClient) {
    return;
  }

  const likeResult = await runningClient
    .from("running_hub_likes")
    .select("post_id,user_id")
    .limit(5000);

  runningLikeCounts = new Map();
  runningLikedByMe = new Set();
  if (likeResult.error) {
    return;
  }

  (Array.isArray(likeResult.data) ? likeResult.data : []).forEach((row) => {
    const postId = String(row.post_id || "");
    if (!postId) {
      return;
    }
    runningLikeCounts.set(postId, Number(runningLikeCounts.get(postId) || 0) + 1);
    if (runningUser?.id && row.user_id === runningUser.id) {
      runningLikedByMe.add(postId);
    }
  });
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
    item.innerHTML = `<div class="list-top"><span class="list-title">${escapeHtml(row.title)}</span><span class="list-meta">${formatDate(row.created_at)}</span></div><p class="list-meta">${categoryLabel(row.category)} / ${escapeHtml(row.author_name || "회원")} / ${statusLabel(row.status)}${row.is_featured ? " / 추천 글" : ""}</p><p>${escapeHtml(row.summary || row.content || "")}</p>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(buildTinyButton("승인", () => updateRunningPost(row.id, { status: "approved" })));
    actions.appendChild(buildTinyButton("반려", () => updateRunningPost(row.id, { status: "rejected", is_featured: false })));
    actions.appendChild(buildTinyButton(row.is_featured ? "추천 해제" : "추천 글", () => updateRunningPost(row.id, { status: "approved", is_featured: !row.is_featured })));
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
    status: "pending",
    is_featured: false
  };

  if (!payload.title || !payload.content) {
    setRunningText(runningPostStatus, "제목과 본문을 입력해 주세요.");
    return;
  }

  setRunningText(runningPostStatus, "등록 중...");
  const result = await runningClient.from("running_hub_posts").insert(payload).select("id").single();
  if (result.error) {
    setRunningText(runningPostStatus, `등록 실패: ${result.error.message}`);
    return;
  }

  if (runningPostTitle) runningPostTitle.value = "";
  if (runningPostSummary) runningPostSummary.value = "";
  if (runningPostContent) runningPostContent.value = "";
  setRunningText(runningPostStatus, "글이 등록되었습니다. 운영진 확인 후 공개됩니다.");
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

async function toggleRunningLike(postId) {
  if (!runningUser) {
    setRunningText(runningPostStatus, "로그인 후 좋아요를 누를 수 있습니다.");
    return;
  }

  const liked = runningLikedByMe.has(postId);
  let result;
  if (liked) {
    result = await runningClient
      .from("running_hub_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", runningUser.id);
  } else {
    result = await runningClient
      .from("running_hub_likes")
      .insert([{ post_id: postId, user_id: runningUser.id }]);
  }

  if (result.error) {
    setRunningText(runningPostStatus, `좋아요 처리 실패: ${result.error.message}`);
    return;
  }

  const currentCount = Number(runningLikeCounts.get(postId) || 0);
  if (liked) {
    runningLikedByMe.delete(postId);
    runningLikeCounts.set(postId, Math.max(0, currentCount - 1));
  } else {
    runningLikedByMe.add(postId);
    runningLikeCounts.set(postId, currentCount + 1);
  }

  renderRunningFeatured(runningPosts.filter((row) => row.is_featured && row.status === "approved").slice(0, 4));
  renderRunningPublic();
}

function renderRunningFeatured(rows) {
  if (!runningFeaturedList) {
    return;
  }

  runningFeaturedList.innerHTML = "";
  if (!rows.length) {
    runningFeaturedList.innerHTML = '<article class="card running-feature-card"><h3>추천 글 준비 중</h3><p class="list-meta">운영진이 추천 루트와 팁을 정리하고 있습니다.</p><p class="list-meta">승인 회원은 글쓰기로 첫 글을 올릴 수 있습니다.</p></article>';
    return;
  }

  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "card running-feature-card";
    const likeCount = Number(runningLikeCounts.get(row.id) || 0);
    const liked = runningLikedByMe.has(row.id);
    card.innerHTML = `
      <div class="running-post-header">
        <h3>${escapeHtml(row.title)}</h3>
        <span class="badge">${categoryLabel(row.category)}</span>
      </div>
      <p class="list-meta">${escapeHtml(row.author_name || "회원")} · ${formatDate(row.created_at)}</p>
      <p class="running-post-summary">${escapeHtml(row.summary || row.content || "")}</p>
      <details class="running-post-details">
        <summary>본문 보기</summary>
        <div class="running-post-body">${escapeHtml(row.content).replaceAll("\n", "<br />")}</div>
      </details>
      <div class="like-row">
        <button class="btn ghost tiny" type="button">${liked ? "좋아요 취소" : "좋아요"}</button>
        <span class="list-meta">좋아요 ${likeCount}</span>
      </div>
    `;
    card.querySelector("button")?.addEventListener("click", () => toggleRunningLike(row.id));
    runningFeaturedList.appendChild(card);
  });
}

function renderRunningPublic() {
  if (!runningPublicList) {
    return;
  }

  const selectedCategory = String(runningFilter?.value || "all");
  const visibleRows = runningPosts.filter((row) => {
    if (selectedCategory !== "all" && row.category !== selectedCategory) {
      return false;
    }
    if (row.status === "approved") {
      return true;
    }
    return runningProfile?.role === "admin" && runningProfile?.approval_status === "approved";
  });

  runningPublicList.innerHTML = "";
  if (!visibleRows.length) {
    const emptyMessage = runningProfile?.approval_status === "approved"
      ? "아직 공개된 글이 없습니다. 글쓰기로 첫 글을 올려 보세요."
      : "조건에 맞는 러닝 허브 글이 없습니다.";
    const cta = runningProfile?.approval_status === "approved"
      ? '<a class="btn primary" href="#running-compose-section">글쓰기</a>'
      : '<a class="btn ghost" href="login.html">로그인하고 글쓰기</a>';
    runningPublicList.innerHTML = `<div class="panel running-empty-state"><p class="list-meta">${emptyMessage}</p><div class="auth-links-row" style="margin-top:0.8rem;">${cta}</div></div>`;
    return;
  }

  visibleRows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "panel running-post-item";
    const adminState = row.status !== "approved"
      ? `<span class="raffle-tag">${statusLabel(row.status)}</span>`
      : "";
    const featuredTag = row.is_featured ? '<span class="raffle-tag">추천 글</span>' : "";
    const likeCount = Number(runningLikeCounts.get(row.id) || 0);
    const liked = runningLikedByMe.has(row.id);
    article.innerHTML = `
      <div class="running-post-header">
        <div>
          <h3>${escapeHtml(row.title)}</h3>
          <p class="list-meta">${escapeHtml(row.author_name || "회원")} · ${formatDate(row.created_at)}</p>
        </div>
        <div class="running-post-tags">
          <span class="raffle-tag">${categoryLabel(row.category)}</span>
          ${featuredTag}
          ${adminState}
        </div>
      </div>
      <p class="running-post-summary">${escapeHtml(row.summary || "요약 없음")}</p>
      <details class="running-post-details">
        <summary>본문 보기</summary>
        <div class="running-post-body">${escapeHtml(row.content).replaceAll("\n", "<br />")}</div>
      </details>
      <div class="like-row">
        <button class="btn ghost tiny" type="button">${liked ? "좋아요 취소" : "좋아요"}</button>
        <span class="list-meta">좋아요 ${likeCount}</span>
      </div>
    `;
    article.querySelector("button")?.addEventListener("click", () => toggleRunningLike(row.id));
    runningPublicList.appendChild(article);
  });
}

function runningRoleLabel(role, approvalStatus) {
  if (approvalStatus !== "approved") {
    return "승인 대기";
  }
  return role === "admin" ? "운영진" : "일반회원";
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
  if (category === "checklist") return "준비 체크리스트";
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
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}



