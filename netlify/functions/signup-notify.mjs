export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed" });
  }

  try {
    const body = await request.json();
    const webhookUrl = envOptional("APPROVAL_NOTIFY_WEBHOOK_URL");
    if (!webhookUrl) {
      return json(200, { ok: true, skipped: true });
    }

    const message = buildMessage(body);
    await sendWebhook(webhookUrl, message);
    return json(200, { ok: true });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function buildMessage(body) {
  const name = String(body?.name || "이름없음").slice(0, 80);
  const email = String(body?.email || "").slice(0, 120);
  const birthYear = Number(body?.birthYear || 0);
  const intro = String(body?.intro || "").trim().slice(0, 300);
  const introLine = intro ? `소개: ${intro}` : "소개: 없음";

  return [
    "[RRC] 신규 가입 신청",
    `이름: ${name}`,
    `이메일: ${email}`,
    `출생연도: ${birthYear || "-"}`,
    introLine,
    "확인 위치: 운영진 페이지 > 회원 가입 승인"
  ].join("\n");
}

async function sendWebhook(url, message) {
  const isDiscord = /discord(?:app)?\.com/i.test(url);
  const payload = isDiscord
    ? { content: message }
    : { text: message, content: message };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`webhook failed: ${response.status}`);
  }
}

function envOptional(name) {
  return process.env[name] || "";
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
