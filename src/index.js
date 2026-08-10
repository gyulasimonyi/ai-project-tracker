export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/me" && request.method === "GET") {
      return Response.json({ canEdit: isEditor(request, env) });
    }

    if (url.pathname === "/api/progress" && request.method === "GET") {
      return getProgress(env);
    }

    if (url.pathname === "/api/progress" && request.method === "POST") {
      return postProgress(request, env);
    }

    if (url.pathname === "/api/order" && request.method === "POST") {
      return postOrder(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

function isEditor(request, env) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  return !!email && email === env.ADMIN_EMAIL;
}

async function getProgress(env) {
  const [progressResult, orderResult] = await Promise.all([
    env.DB.prepare("SELECT project_id, percent FROM progress").all(),
    env.DB.prepare("SELECT project_id FROM project_order ORDER BY position ASC").all()
  ]);

  const progress = {};
  for (const row of progressResult.results) {
    progress[row.project_id] = row.percent;
  }

  const order = orderResult.results.map(row => row.project_id);

  return Response.json({ progress, order });
}

async function postProgress(request, env) {
  if (!isEditor(request, env)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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

async function postOrder(request, env) {
  if (!isEditor(request, env)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { order } = body;

  const isValid = Array.isArray(order)
    && order.length > 0
    && order.every(id => Number.isInteger(id))
    && new Set(order).size === order.length;

  if (!isValid) {
    return Response.json({ error: "order must be an array of unique integers" }, { status: 400 });
  }

  const statements = [env.DB.prepare("DELETE FROM project_order")];
  order.forEach((id, position) => {
    statements.push(
      env.DB.prepare("INSERT INTO project_order (project_id, position) VALUES (?, ?)").bind(id, position)
    );
  });
  await env.DB.batch(statements);

  return Response.json({ order });
}
