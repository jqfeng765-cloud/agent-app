# left-browser

在 DeepSeek Harness Web UI **左侧**固定网页，并快速切换多个浏览器窗口。

规划见仓库根目录 [`docs/left-browser-pane.md`](../../docs/left-browser-pane.md)。

当前只有规划，还没有可运行的 Client 半边。实现后用官方 patch 加载：

```sh
cd deepseek-harness
pnpm dsh web --patch ../plugins/left-browser/cordis.yml
```

`cordis.yml` 里的 `name` 必须写成这个插件文件的**绝对路径**。
