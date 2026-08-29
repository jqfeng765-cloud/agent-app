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
