import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeUserDelete,
  authorizeUserUpdate,
  frontendFieldPolicy,
  SENSITIVE_FIELDS,
} from "./policy.js";

const admin = { id: "u-admin", role: "admin" };
const alice = { id: "u-alice", role: "user" };

describe("authorizeUserUpdate (FJQ-48)", () => {
  it("rejects unauthenticated updates", () => {
    const result = authorizeUserUpdate(null, "u-alice", { displayName: "X" });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("blocks a regular user from changing their own organization", () => {
    const result = authorizeUserUpdate(alice, "u-alice", {
      organizationId: "org-hq",
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.deepEqual(result.fields, ["organizationId"]);
  });

  it("blocks a regular user from changing their own password", () => {
    const result = authorizeUserUpdate(alice, "u-alice", {
      password: "hacked",
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.deepEqual(result.fields, ["password"]);
  });

  it("blocks a regular user from changing their own role", () => {
    const result = authorizeUserUpdate(alice, "u-alice", { role: "admin" });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.deepEqual(result.fields, ["role"]);
  });

  it("blocks a regular user from changing all sensitive fields in one request", () => {
    const result = authorizeUserUpdate(alice, "u-alice", {
      organizationId: "org-hq",
      password: "x",
      role: "admin",
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.fields, [...SENSITIVE_FIELDS]);
  });

  it("blocks a regular user from editing another user", () => {
    const result = authorizeUserUpdate(alice, "u-bob", {
      displayName: "Nope",
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("allows a regular user to update their own profile fields", () => {
    const result = authorizeUserUpdate(alice, "u-alice", {
      displayName: "Alice C.",
      email: "alice.c@datacenter.local",
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.patch, {
      displayName: "Alice C.",
      email: "alice.c@datacenter.local",
    });
  });

  it("allows an admin to change organization, password, and role", () => {
    const result = authorizeUserUpdate(admin, "u-alice", {
      organizationId: "org-hq",
      password: "reset-me",
      role: "admin",
    });
    assert.equal(result.ok, true);
    assert.equal(result.patch.organizationId, "org-hq");
    assert.equal(result.patch.password, "reset-me");
    assert.equal(result.patch.role, "admin");
  });
});

describe("authorizeUserDelete", () => {
  it("blocks regular users from deleting anyone", () => {
    const result = authorizeUserDelete(alice, "u-bob");
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("allows an admin to delete another user", () => {
    const result = authorizeUserDelete(admin, "u-bob");
    assert.equal(result.ok, true);
  });

  it("does not allow an admin to delete themselves", () => {
    const result = authorizeUserDelete(admin, "u-admin");
    assert.equal(result.ok, false);
  });
});

describe("frontendFieldPolicy", () => {
  it("hides organization, password, and role editors for regular users", () => {
    const policy = frontendFieldPolicy(alice);
    assert.equal(policy.canDelete, false);
    assert.equal(policy.canManageUsers, false);
    assert.ok(!policy.editable.includes("organizationId"));
    assert.ok(!policy.editable.includes("password"));
    assert.ok(!policy.editable.includes("role"));
    assert.deepEqual(policy.readOnly, ["organizationId", "role"]);
  });

  it("exposes organization, password, and role editors for admins", () => {
    const policy = frontendFieldPolicy(admin);
    assert.equal(policy.canDelete, true);
    assert.ok(policy.editable.includes("organizationId"));
    assert.ok(policy.editable.includes("password"));
    assert.ok(policy.editable.includes("role"));
  });
});
