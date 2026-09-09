import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function cloneUser(user, { includePassword = false } = {}) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  if (includePassword) {
    return { ...user };
  }
  void passwordHash;
  return { ...publicUser };
}

export function createStore() {
  const organizations = [
    { id: "org-hq", name: "总部" },
    { id: "org-east", name: "华东分中心" },
    { id: "org-west", name: "西部节点" },
  ];

  const users = [
    {
      id: "u-admin",
      username: "admin",
      displayName: "系统管理员",
      email: "admin@datacenter.local",
      organizationId: "org-hq",
      role: "admin",
      passwordHash: hashPassword("admin123"),
    },
    {
      id: "u-alice",
      username: "alice",
      displayName: "Alice Chen",
      email: "alice@datacenter.local",
      organizationId: "org-east",
      role: "user",
      passwordHash: hashPassword("alice123"),
    },
    {
      id: "u-bob",
      username: "bob",
      displayName: "Bob Li",
      email: "bob@datacenter.local",
      organizationId: "org-west",
      role: "user",
      passwordHash: hashPassword("bob123"),
    },
  ];

  const sessions = new Map();

  return {
    listOrganizations() {
      return organizations.map((org) => ({ ...org }));
    },
    listUsers() {
      return users.map((user) => cloneUser(user));
    },
    getUserById(id) {
      return cloneUser(users.find((user) => user.id === id));
    },
    getUserRecord(id) {
      return users.find((user) => user.id === id) || null;
    },
    findByUsername(username) {
      return users.find((user) => user.username === username) || null;
    },
    authenticate(username, password) {
      const record = this.findByUsername(username);
      if (!record || !verifyPassword(password, record.passwordHash)) {
        return null;
      }
      const token = randomBytes(24).toString("hex");
      sessions.set(token, record.id);
      return { token, user: cloneUser(record) };
    },
    userFromToken(token) {
      if (!token) return null;
      const userId = sessions.get(token);
      return userId ? cloneUser(this.getUserRecord(userId)) : null;
    },
    applyPatch(userId, patch) {
      const record = this.getUserRecord(userId);
      if (!record) return null;
      if (Object.hasOwn(patch, "displayName")) {
        record.displayName = String(patch.displayName);
      }
      if (Object.hasOwn(patch, "email")) {
        record.email = String(patch.email);
      }
      if (Object.hasOwn(patch, "organizationId")) {
        const org = organizations.find((item) => item.id === patch.organizationId);
        if (!org) {
          throw Object.assign(new Error("机构不存在"), { status: 400 });
        }
        record.organizationId = org.id;
      }
      if (Object.hasOwn(patch, "role")) {
        if (patch.role !== "admin" && patch.role !== "user") {
          throw Object.assign(new Error("无效角色"), { status: 400 });
        }
        record.role = patch.role;
      }
      if (Object.hasOwn(patch, "password")) {
        if (!String(patch.password)) {
          throw Object.assign(new Error("密码不能为空"), { status: 400 });
        }
        record.passwordHash = hashPassword(String(patch.password));
      }
      return cloneUser(record);
    },
    deleteUser(userId) {
      const index = users.findIndex((user) => user.id === userId);
      if (index === -1) return false;
      users.splice(index, 1);
      for (const [token, id] of sessions.entries()) {
        if (id === userId) sessions.delete(token);
      }
      return true;
    },
  };
}
