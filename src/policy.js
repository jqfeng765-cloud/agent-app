/** Fields that privilege a user or reset credentials. Regular users must not set these. */
export const SENSITIVE_FIELDS = Object.freeze([
  "organizationId",
  "password",
  "role",
]);

/** Non-sensitive profile fields a user may update on themselves. */
export const PROFILE_FIELDS = Object.freeze(["displayName", "email"]);

const OWNED_KEYS = (obj) =>
  Object.keys(obj || {}).filter((key) =>
    Object.prototype.hasOwnProperty.call(obj, key),
  );

/**
 * Backend gate for PATCH /users/:id.
 * Regular users cannot change organization, password, or role (FJQ-48).
 * They also cannot mutate other users. Delete is separately forbidden.
 */
export function authorizeUserUpdate(actor, targetId, patch = {}) {
  if (!actor) {
    return { ok: false, status: 401, error: "未登录" };
  }

  const attemptedSensitive = SENSITIVE_FIELDS.filter((field) =>
    OWNED_KEYS(patch).includes(field),
  );

  if (actor.role !== "admin") {
    if (attemptedSensitive.length > 0) {
      return {
        ok: false,
        status: 403,
        error: "普通用户不能修改机构、密码或角色",
        fields: attemptedSensitive,
      };
    }
    if (actor.id !== targetId) {
      return { ok: false, status: 403, error: "普通用户不能修改其他用户" };
    }
  }

  const allowedKeys =
    actor.role === "admin"
      ? [...PROFILE_FIELDS, ...SENSITIVE_FIELDS]
      : [...PROFILE_FIELDS];

  const allowed = {};
  for (const key of allowedKeys) {
    if (OWNED_KEYS(patch).includes(key)) {
      allowed[key] = patch[key];
    }
  }

  return { ok: true, patch: allowed };
}

/** Backend gate for DELETE /users/:id. Regular users cannot delete anyone. */
export function authorizeUserDelete(actor, targetId) {
  if (!actor) {
    return { ok: false, status: 401, error: "未登录" };
  }
  if (actor.role !== "admin") {
    return { ok: false, status: 403, error: "普通用户不能删除用户" };
  }
  if (actor.id === targetId) {
    return { ok: false, status: 403, error: "不能删除自己" };
  }
  return { ok: true };
}

/**
 * Frontend field policy. Regular users never see editors for
 * organization / password / role, and never see delete.
 */
export function frontendFieldPolicy(actor) {
  if (!actor) {
    return {
      canManageUsers: false,
      editable: [],
      readOnly: [],
      canDelete: false,
    };
  }

  if (actor.role === "admin") {
    return {
      canManageUsers: true,
      editable: ["displayName", "email", "organizationId", "password", "role"],
      readOnly: [],
      canDelete: true,
    };
  }

  return {
    canManageUsers: false,
    editable: ["displayName", "email"],
    readOnly: ["organizationId", "role"],
    canDelete: false,
  };
}

export function isSensitiveField(field) {
  return SENSITIVE_FIELDS.includes(field);
}
