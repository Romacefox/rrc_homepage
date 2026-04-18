const TABLE = "member_profiles";

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed" });
  }

  try {
    const body = await request.json();
    const userId = String(body?.user_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const birthYear = Number(body?.birth_year || 0);
    const intro = String(body?.intro || "").trim();

    if (!userId || !email || !name || !birthYear) {
      return json(400, { ok: false, error: "missing required fields" });
    }
    if (birthYear < 1989 || birthYear > 2000) {
      return json(400, { ok: false, error: "invalid birth_year" });
    }

    await removeStaleProfilesByEmail(email, userId);
    const existing = await loadExistingProfile(userId);
    const payload = existing
      ? {
          user_id: userId,
          email: existing.email || email,
          name: existing.name || name,
          birth_year: Number(existing.birth_year || birthYear),
          intro: String(existing.intro || intro || "").trim(),
          role: existing.role || "member",
          approval_status: existing.approval_status || "pending"
        }
      : {
          user_id: userId,
          email,
          name,
          birth_year: birthYear,
          intro,
          role: "member",
          approval_status: "pending"
        };

    await supabaseUpsert(TABLE, payload, "user_id");
    return json(200, { ok: true, existed: Boolean(existing?.user_id) });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function loadExistingProfile(userId) {
  const rows = await supabaseSelect(`${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,name,birth_year,intro,approval_status,role&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function removeStaleProfilesByEmail(email, currentUserId) {
  const rows = await supabaseSelect(`${TABLE}?email=eq.${encodeURIComponent(email)}&select=user_id,approval_status,role&limit=20`);
  const duplicates = (Array.isArray(rows) ? rows : []).filter((row) => String(row?.user_id || "") !== currentUserId);

  for (const row of duplicates) {
    const approvalStatus = String(row?.approval_status || "pending");
    const role = String(row?.role || "member");
    const isProtected = approvalStatus === "approved" || role === "admin";
    if (isProtected) {
      throw new Error("email already linked to an approved profile");
    }
    await supabaseDelete(`${TABLE}?user_id=eq.${encodeURIComponent(String(row.user_id || ""))}`);
  }
}

async function supabaseSelect(path) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function supabaseUpsert(table, payload, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function supabaseDelete(path) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    method: "DELETE",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

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
