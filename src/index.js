export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/progress" && request.method === "GET") {
      return getProgress(env);
    }

    if (url.pathname === "/api/progress" && request.method === "POST") {
      return postProgress(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function getProgress(env) {
  const { results } = await env.DB
    .prepare("SELECT project_id, percent FROM progress")
    .all();

  const out = {};
  for (const row of results) {
    out[row.project_id] = row.percent;
  }

  return Response.json(out);
}

async function postProgress(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, percent } = body;

  if (!Number.isInteger(id)) {
    return Response.json({ error: "id must be an integer" }, { status: 400 });
  }
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return Response.json({ error: "percent must be an integer 0-100" }, { status: 400 });
  }

  await env.DB
    .prepare(
      `INSERT INTO progress (project_id, percent, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT (project_id) DO UPDATE SET percent = excluded.percent, updated_at = excluded.updated_at`
    )
    .bind(id, percent, new Date().toISOString())
    .run();

  return Response.json({ id, percent });
}
