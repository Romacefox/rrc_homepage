export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed" });
  }

  try {
    const body = await request.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");
    if (!email || !password) {
      return json(400, { ok: false, error: "missing credentials" });
    }

    const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env("SUPABASE_ANON_KEY")
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json().catch(() => ({ error: "invalid auth response" }));
    if (!response.ok) {
      return json(response.status, {
        ok: false,
        error: String(result?.error_description || result?.msg || result?.error || "login failed")
      });
    }

    return json(200, {
      ok: true,
      session: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        expires_at: result.expires_at
      },
      user: result.user || null
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
