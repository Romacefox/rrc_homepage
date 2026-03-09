const WINTER_MONTHS_DEFAULT = [12, 1, 2];
const DEFAULT_THRESHOLD = 5;
const WINTER_THRESHOLD = 4;
const DEFAULT_WINNER_COUNT = 4;

export default async (request, context) => {
  try {
    const now = new Date();
    const drawId = monthKey(now); // e.g. 2026-04 (draw run month)
    const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const targetMonthKey = monthKey(targetDate);

    const existing = await supabaseSelect("raffle_history", `draw_id=eq.${drawId}&select=draw_id&limit=1`);
    if (existing.length > 0) {
      return json(200, { ok: true, skipped: true, reason: "already_drawn", drawId, targetMonthKey });
    }

    const config = await getRaffleConfig();
    const threshold = thresholdFor(targetMonthKey, config);
    const winnerCount = Number(config.winner_count || DEFAULT_WINNER_COUNT);

    const members = await supabaseSelect("members", "is_active=eq.true&select=id,name,monthly_runs");
    const candidates = members.filter((member) => monthlyRunsOf(member, targetMonthKey) >= threshold);
    const winners = pickWinners(candidates, winnerCount).map((member) => ({
      id: member.id,
      name: member.name,
      runs: monthlyRunsOf(member, targetMonthKey)
    }));

    await supabaseInsert("raffle_history", {
      draw_id: drawId,
      target_month_key: targetMonthKey,
      threshold,
      winner_count: winnerCount,
      winners
    });

    const title = `${labelMonth(targetMonthKey)} 참여상 추첨 결과`;
    const content = winners.length > 0
      ? `${winners.map((winner) => winner.name).join(", ")} 축하합니다!`
      : `조건(${threshold}회 이상) 충족 회원이 없어 당첨자가 없습니다.`;

    await supabaseInsert("notices", { title, content });

    return json(200, {
      ok: true,
      drawId,
      targetMonthKey,
      threshold,
      winnerCount,
      winners
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function getRaffleConfig() {
  const rows = await supabaseSelect("settings", "key=eq.raffle_config&select=value&limit=1");
  const value = rows[0]?.value;

  if (!value || typeof value !== "object") {
    return {
      winter_months: WINTER_MONTHS_DEFAULT,
      default_threshold: DEFAULT_THRESHOLD,
      winter_threshold: WINTER_THRESHOLD,
      winner_count: DEFAULT_WINNER_COUNT
    };
  }

  return value;
}

function thresholdFor(targetMonthKey, config) {
  const month = Number(targetMonthKey.split("-")[1]);
  const winterMonths = Array.isArray(config.winter_months) ? config.winter_months.map(Number) : WINTER_MONTHS_DEFAULT;
  if (winterMonths.includes(month)) {
    return Number(config.winter_threshold || WINTER_THRESHOLD);
  }
  return Number(config.default_threshold || DEFAULT_THRESHOLD);
}

function monthlyRunsOf(member, targetMonthKey) {
  const map = member.monthly_runs && typeof member.monthly_runs === "object" ? member.monthly_runs : {};
  return Number(map[targetMonthKey] || 0);
}

function pickWinners(candidates, winnerCount) {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, winnerCount);
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelMonth(key) {
  const [year, month] = key.split("-");
  return `${year}년 ${month}월`;
}

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

async function supabaseSelect(table, query) {
  const url = `${env("SUPABASE_URL")}/rest/v1/${table}?${query}`;
  const response = await fetch(url, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Select failed: ${table} ${response.status} ${body}`);
  }

  return response.json();
}

async function supabaseInsert(table, payload) {
  const url = `${env("SUPABASE_URL")}/rest/v1/${table}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Insert failed: ${table} ${response.status} ${body}`);
  }

  return response.json();
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
