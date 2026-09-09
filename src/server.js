import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizeUserDelete, authorizeUserUpdate, frontendFieldPolicy } from "./policy.js";
import { createStore } from "./store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const PORT = Number(process.env.PORT || 3088);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

export function createApp(store = createStore()) {
  async function handleApi(req, res, url) {
    const actor = store.userFromToken(bearer(req));

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(req);
      const result = store.authenticate(body.username, body.password);
      if (!result) return send(res, 401, { error: "用户名或密码错误" });
      return send(res, 200, {
        token: result.token,
        user: result.user,
        fieldPolicy: frontendFieldPolicy(result.user),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      if (!actor) return send(res, 401, { error: "未登录" });
      return send(res, 200, {
        user: actor,
        fieldPolicy: frontendFieldPolicy(actor),
        organizations: store.listOrganizations(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      if (!actor) return send(res, 401, { error: "未登录" });
      const users =
        actor.role === "admin"
          ? store.listUsers()
          : store.listUsers().filter((user) => user.id === actor.id);
      return send(res, 200, { users });
    }

    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
      if (!actor) return send(res, 401, { error: "未登录" });
      const targetId = decodeURIComponent(userMatch[1]);
      const target = store.getUserById(targetId);
      if (!target) return send(res, 404, { error: "用户不存在" });

      if (req.method === "PATCH") {
        const body = await readJson(req);
        const decision = authorizeUserUpdate(actor, targetId, body);
        if (!decision.ok) {
          return send(res, decision.status, {
            error: decision.error,
            fields: decision.fields,
          });
        }
        try {
          const user = store.applyPatch(targetId, decision.patch);
          return send(res, 200, { user });
        } catch (error) {
          return send(res, error.status || 400, { error: error.message });
        }
      }

      if (req.method === "DELETE") {
        const decision = authorizeUserDelete(actor, targetId);
        if (!decision.ok) {
          return send(res, decision.status, { error: decision.error });
        }
        store.deleteUser(targetId);
        return send(res, 200, { ok: true });
      }
    }

    return send(res, 404, { error: "接口不存在" });
  }

  return async function app(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(req, res, url);
      }
      const filePath =
        url.pathname === "/"
          ? join(PUBLIC_DIR, "index.html")
          : join(PUBLIC_DIR, url.pathname.replace(/^\/+/, ""));
      const data = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[extname(filePath)] || "application/octet-stream",
      });
      res.end(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return send(res, 404, { error: "未找到" });
      }
      send(res, 500, { error: "服务器错误" });
    }
  };
}

export function startServer({ port = PORT, store = createStore() } = {}) {
  const server = createServer(createApp(store));
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port, store });
    });
  });
}

function bearer(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer();
  console.log(`user-admin listening on http://127.0.0.1:${port}`);
}
