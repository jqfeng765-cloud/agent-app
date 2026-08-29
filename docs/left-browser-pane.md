# 左侧固定浏览器窗格：调研与实现规划

目标：在 DeepSeek Harness Web UI 里**快速切换多个网页窗口**，并把当前网页**固定在界面左侧**，和中间对话并列。

## 结论

**没有完全对口的现成插件，所以不直接安装社区包。**

| 候选 | 能做什么 | 为什么不够 |
|---|---|---|
| 官方 Web UI | 左栏是会话/工作区导航，右栏是 details | 左栏不是网页容器；往 `sidebar` slot 注册会**整栏替换**官方导航 |
| [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 多网页 tab、前进后退、沙箱 iframe、拖 tab 切换/拆分/浮动窗 | 工作台在**右侧 + 底部**，不能把网页钉在左侧 |
| [@dsh-external/ego-browser](https://www.npmjs.com/package/@dsh-external/ego-browser) | Agent 浏览器 tab；有 better-sidebar 时挂到侧栏，否则浮动气泡 | 同样不提供左侧固定栏 |
| 官方 `web_fetch` / `dsh-tool-web` | 模型抓取网页正文 | 不是可视化浏览器，不能开窗、切窗、钉栏 |

`dsh-better-sidebar` 是最接近的现成能力（约 2.6k star，MIT）。如果只是「聊天旁边开网页」，可以先装它试手感：

```sh
dsh plugin --profile web add dsh-better-sidebar@latest
```

它解决不了「固定在左侧」。本仓库要做的是一个**独立的左侧浏览器 Dock 插件**，不 fork `deepseek-harness`，也不替换官方左栏。

## 官方布局约束（必须遵守）

Web GUI 是三栏 `AppFrame`：

```
[ sidebar | conversation | details ]
                 ↑
           shell.overlay 盖在整框之上
```

关键 slot：

- `sidebar`：`single`。已被 `ui-sidebar` 占用。再注册会换掉整个左栏，会话列表消失。
- `conversation` / `details`：中间对话和右侧详情。
- `shell.overlay`：`list`，官方明确允许第三方**叠加**全框浮层；新 `id` 是增量挂载，不会挤掉官方 UI。层默认点击穿透，条目自己打开 `pointer-events`。

因此正确挂载点是 **`shell.overlay`**，自己画一条贴左的 Dock，而不是去占 `sidebar`。

官方左栏收起后仍保留 56px 控制轨。Dock 应停在这条轨的**右侧**，避免挡住 New Session / Settings。

## 产品形态

```
[ 官方会话轨 56px ] [ 网页 Dock 可拖宽 ] [ 对话 ] [ details ]
                      ├ tab 条（切换/钉/关）
                      └ iframe 或降级提示
```

一屏同时满足两件事：

1. **快速切换**：Dock 顶栏是窗口列表（tab / 缩略条），`1–9` 或 `Ctrl+[` / `Ctrl+]` 切窗。
2. **固定左侧**：至少一个窗口处于 pinned；pinned 时 Dock 常驻，刷新后按会话恢复。

未 pin 时只显示一条窄轨（图标 + 打开数），不抢对话宽度。

## 架构（树外插件，不改进程内 dsh）

```
plugins/left-browser/
  src/index.ts            # host：可选，给模型 open/pin/switch 工具
  src/client/index.ts     # client：注册 shell.overlay + store
  cordis.yml              # web profile patch
```

职责拆分：

| 半边 | 做什么 | 不做什么 |
|---|---|---|
| Client | 窗口列表、pin、布局宽度、iframe、快捷键、设置项 | 不改 `AppFrame`，不替换 `sidebar` |
| Host（第二期） | `browser_open` / `browser_pin` / `browser_switch` 工具，把模型打开的 URL 推到 Dock | 不自己渲染 UI |

Client 用官方 slot store 保存查看态（当前窗口、pin、宽度）。按 `sessionId` 隔离，和 better-sidebar「按会话持久化」一致。

加载方式（实现后）：

```sh
cd deepseek-harness
pnpm dsh web --patch ../plugins/left-browser/cordis.yml
```

`cordis.yml` 里的插件路径必须是绝对路径，这是官方 loader 的约束。

## 分阶段

### P0 — 可钉、可切的左侧 Dock

- 在 `shell.overlay` 注册 `id: left-browser-dock`。
- 状态：`windows[]`（id / title / url / pinned / createdAt）、`activeId`、`dockWidth`、`collapsed`。
- UI：贴左可拖宽面板；顶栏 tab；地址栏；固定 / 取消固定；关闭。
- 网页用沙箱 iframe（`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` 起步，设置里可收紧）。
- 快捷键：`Ctrl+Shift+B` 开合 Dock；`Ctrl+[` / `Ctrl+]` 切窗；`Ctrl+1…9` 跳到第 n 个窗口。
- 被 `X-Frame-Options` / CSP `frame-ancestors` 挡住时，显示「无法内嵌」和「系统浏览器打开」。

### P1 — 和对话打通

- 拦截对话里的 http(s) 链接，提供「在左侧打开 / 固定」。
- Host 工具：`browser_open`、`browser_pin`、`browser_switch`，方便模型把参考页钉在左边。
- 设置页加一张卡片（官方 settings slot），开关：默认 pin、外链是否接管、https 是否允许 iframe。

### P2 — 真窗口，而不是只换 iframe src

- 每个窗口保留自己的 iframe 实例（切走时 `visibility:hidden`，不销毁），滚动位置和表单尽量保住。
- 这才是「切换浏览器窗口」；只改一个 iframe 的 `src` 只是切 URL。

不做的事：

- 不 fork / 不改 `deepseek-harness` 源码。
- 不替换官方 `sidebar`。
- 不把 better-sidebar 整包搬进来再改 CSS 挪到左边（升级会碎）。
- 第一期不做完整 Chromium / CDP 浏览器（登录态、跨站 cookie、反 iframe 站点都需要独立内核，那是桌面壳的范围）。

## 风险

1. **很多站点禁止被 iframe**。P0 必须有明确降级，不能假装能浏览所有网页。
2. **沙箱登录态差**。和 better-sidebar 一样，不透明源沙箱里 cookie / SSO 经常不可用。
3. **官方左栏宽度是瞬时态**（刷新重置）。Dock 自己的宽度和 pin 要自己持久化，不要依赖 `ctx.layout`。
4. **dsh 仍是开发者预览**。`ctx.slots` API 可能变；插件钉 dsh 版本，升级当迁移。
5. **窄屏**。宽度不足时 Dock 改成抽屉，避免和官方让步链（先挤 details）打架。

## 建议实现顺序

1. 空 Client 插件挂上 `shell.overlay`，确认左侧出现一块有色面板、官方会话栏还在。
2. 加上可拖宽 + pin 开关 + 本地窗口列表。
3. 接入 iframe 与打不开时的降级。
4. 再加快捷键、外链接管、Host 工具。

骨架目录已放在 `plugins/left-browser/`。下一步从 P0 的 overlay 挂载开始写，不要先装 better-sidebar。
