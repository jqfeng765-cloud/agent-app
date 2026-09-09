const state = {
  token: localStorage.getItem("token") || "",
  user: null,
  fieldPolicy: null,
  organizations: [],
  users: [],
};

const loginPanel = document.querySelector("#login-panel");
const appPanel = document.querySelector("#app-panel");
const sessionSlot = document.querySelector("#session-slot");
const loginError = document.querySelector("#login-error");
const policyBanner = document.querySelector("#policy-banner");
const userList = document.querySelector("#user-list");

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: {
        username: form.get("username"),
        password: form.get("password"),
      },
    });
    state.token = data.token;
    localStorage.setItem("token", data.token);
    await boot();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});

async function boot() {
  if (!state.token) {
    renderLoggedOut();
    return;
  }
  try {
    const me = await api("/api/me");
    state.user = me.user;
    state.fieldPolicy = me.fieldPolicy;
    state.organizations = me.organizations;
    const list = await api("/api/users");
    state.users = list.users;
    renderApp();
  } catch {
    logout();
  }
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  renderLoggedOut();
}

function renderLoggedOut() {
  loginPanel.hidden = false;
  appPanel.hidden = true;
  sessionSlot.innerHTML = "";
}

function renderApp() {
  loginPanel.hidden = true;
  appPanel.hidden = false;
  sessionSlot.innerHTML = `
    <div>
      <div>${escapeHtml(state.user.displayName)} · ${roleLabel(state.user.role)}</div>
      <button class="secondary" type="button" id="logout-btn">退出</button>
    </div>
  `;
  document.querySelector("#logout-btn").addEventListener("click", logout);

  const policy = state.fieldPolicy;
  policyBanner.innerHTML = policy.canManageUsers
    ? "当前是管理员：可以改机构 / 密码 / 角色，也可以删除其他用户。"
    : "当前是普通用户：机构、密码、角色为只读，删除按钮不可用。后端同样会拒绝这些改动。";

  userList.innerHTML = state.users.map((user) => userCard(user, policy)).join("");
  userList.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", onSave);
  });
  userList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", onDelete);
  });
}

function userCard(user, policy) {
  const canEdit = (field) => policy.editable.includes(field);
  const orgName = orgLabel(user.organizationId);
  return `
    <article class="card" data-user-id="${user.id}">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(user.displayName)}</h3>
          <p class="muted">${escapeHtml(user.username)} · ${escapeHtml(user.email)}</p>
        </div>
        <span>${roleLabel(user.role)}</span>
      </div>
      <form>
        <input type="hidden" name="id" value="${user.id}" />
        <div class="grid">
          <label>
            显示名
            <input name="displayName" value="${escapeAttr(user.displayName)}" ${canEdit("displayName") ? "" : "disabled"} />
          </label>
          <label>
            邮箱
            <input name="email" value="${escapeAttr(user.email)}" ${canEdit("email") ? "" : "disabled"} />
          </label>
          <label>
            机构
            ${
              canEdit("organizationId")
                ? `<select name="organizationId">${state.organizations
                    .map(
                      (org) =>
                        `<option value="${org.id}" ${org.id === user.organizationId ? "selected" : ""}>${escapeHtml(org.name)}</option>`,
                    )
                    .join("")}</select>`
                : `<div class="readonly">${escapeHtml(orgName)}</div>`
            }
          </label>
          <label>
            角色
            ${
              canEdit("role")
                ? `<select name="role">
                    <option value="user" ${user.role === "user" ? "selected" : ""}>普通用户</option>
                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>管理员</option>
                  </select>`
                : `<div class="readonly">${roleLabel(user.role)}</div>`
            }
          </label>
          ${
            canEdit("password")
              ? `<label>重置密码<input name="password" type="password" placeholder="留空则不改" /></label>`
              : `<label>密码<div class="readonly">普通用户不可改</div></label>`
          }
        </div>
        <div class="actions">
          <button type="submit">保存资料</button>
          <button type="button" class="danger" data-delete="${user.id}" ${policy.canDelete && user.id !== state.user.id ? "" : "disabled"}>
            删除
          </button>
          <span class="status muted"></span>
        </div>
      </form>
    </article>
  `;
}

async function onSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".status");
  const id = form.id.value;
  const policy = state.fieldPolicy;
  const patch = {};

  if (policy.editable.includes("displayName")) patch.displayName = form.displayName.value;
  if (policy.editable.includes("email")) patch.email = form.email.value;
  if (policy.editable.includes("organizationId")) patch.organizationId = form.organizationId.value;
  if (policy.editable.includes("role")) patch.role = form.role.value;
  if (policy.editable.includes("password") && form.password?.value) {
    patch.password = form.password.value;
  }

  try {
    await api(`/api/users/${id}`, { method: "PATCH", body: patch });
    status.className = "status ok";
    status.textContent = "已保存";
    await boot();
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  }
}

async function onDelete(event) {
  const id = event.currentTarget.getAttribute("data-delete");
  if (!id || !state.fieldPolicy.canDelete) return;
  try {
    await api(`/api/users/${id}`, { method: "DELETE" });
    await boot();
  } catch (error) {
    event.currentTarget.closest("form").querySelector(".status").textContent =
      error.message;
  }
}

async function api(path, { method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

function orgLabel(id) {
  return state.organizations.find((org) => org.id === id)?.name || id;
}

function roleLabel(role) {
  return role === "admin" ? "管理员" : "普通用户";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

boot();
