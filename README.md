# agent-app

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的二次开发仓库。

上游源码以 git submodule 形式放在 `deepseek-harness/`，当前钉在 `dsh-v0.1.2-alpha.1`（`master`）。

## 拉取仓库

```sh
git clone --recurse-submodules <this-repo-url>
```

若已经 clone 过但还没初始化 submodule：

```sh
git submodule update --init --recursive
```

更新到上游 `master` 最新提交：

```sh
git submodule update --remote deepseek-harness
```

## 从源码运行 dsh

```sh
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

或使用官方预览包：

```sh
npx @deepseek-ai/dsh web
```

## 二次开发

左侧固定网页 / 快速切窗的调研与实现规划：[docs/left-browser-pane.md](docs/left-browser-pane.md)。自研插件目录：`plugins/left-browser/`。

### 已安装：dsh-better-sidebar

用官方命令把社区工作台装进本机 web profile（右侧栏 + 底部面板，含内嵌浏览器 tab）：

```sh
dsh plugin --profile web add dsh-better-sidebar@latest
```

本环境已装到 `~/.dsh/profiles/web`，版本 `0.17.1`，并已放行 `node-pty` 构建脚本。其他机器可复用：

```sh
./scripts/install-better-sidebar.sh
```

然后启动 Web UI 并硬刷新（需要 Node `^22.19` 或 `>=24`；本环境默认 22.14 会因缺少 `zlib.createZstdDecompress` 启动失败）：

```sh
dsh web
# 打开 http://127.0.0.1:3080 后 Ctrl/Cmd+Shift+R
```
