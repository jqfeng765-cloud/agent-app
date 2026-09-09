import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./server.js";
import { createStore } from "./store.js";

let server;
let base;

async function json(path, { method = "GET", token, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function login(username, password) {
  const { status, data } = await json("/api/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(status, 200, data.error);
  return data;
}

describe("user management API (FJQ-48)", { concurrency: false }, () => {
  before(async () => {
    const started = await startServer({ port: 0, store: createStore() });
    server = started.server;
    const address = server.address();
    base = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("rejects regular-user updates to organization, password, and role", async () => {
    const { token, fieldPolicy } = await login("alice", "alice123");
    assert.equal(fieldPolicy.canDelete, false);
    assert.ok(!fieldPolicy.editable.includes("organizationId"));
    assert.ok(!fieldPolicy.editable.includes("password"));
    assert.ok(!fieldPolicy.editable.includes("role"));

    const org = await json("/api/users/u-alice", {
      method: "PATCH",
      token,
      body: { organizationId: "org-hq" },
    });
    assert.equal(org.status, 403);

    const password = await json("/api/users/u-alice", {
      method: "PATCH",
      token,
      body: { password: "new-pass" },
    });
    assert.equal(password.status, 403);

    const role = await json("/api/users/u-alice", {
      method: "PATCH",
      token,
      body: { role: "admin" },
    });
    assert.equal(role.status, 403);

    const after = await json("/api/me", { token });
    assert.equal(after.data.user.organizationId, "org-east");
    assert.equal(after.data.user.role, "user");

    const stillAlice = await json("/api/login", {
      method: "POST",
      body: { username: "alice", password: "alice123" },
    });
    assert.equal(stillAlice.status, 200);
  });

  it("keeps delete blocked for regular users", async () => {
    const { token } = await login("alice", "alice123");
    const res = await json("/api/users/u-bob", { method: "DELETE", token });
    assert.equal(res.status, 403);
  });

  it("lets a regular user update their own display name only", async () => {
    const { token } = await login("alice", "alice123");
    const res = await json("/api/users/u-alice", {
      method: "PATCH",
      token,
      body: { displayName: "Alice Updated" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.displayName, "Alice Updated");
    assert.equal(res.data.user.role, "user");
    assert.equal(res.data.user.organizationId, "org-east");
  });

  it("does not leak other users to a regular account", async () => {
    const { token } = await login("alice", "alice123");
    const res = await json("/api/users", { token });
    assert.equal(res.status, 200);
    assert.equal(res.data.users.length, 1);
    assert.equal(res.data.users[0].username, "alice");
  });

  it("lets an admin change organization, password, and role", async () => {
    const { token } = await login("admin", "admin123");
    const res = await json("/api/users/u-bob", {
      method: "PATCH",
      token,
      body: {
        organizationId: "org-hq",
        password: "bob-reset",
        role: "admin",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.organizationId, "org-hq");
    assert.equal(res.data.user.role, "admin");

    const relogin = await json("/api/login", {
      method: "POST",
      body: { username: "bob", password: "bob-reset" },
    });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.data.user.role, "admin");
  });
});
