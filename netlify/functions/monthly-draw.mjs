export default async () => json(410, {
  ok: false,
  error: "monthly draw is disabled. Use the admin manual raffle button."
});

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
