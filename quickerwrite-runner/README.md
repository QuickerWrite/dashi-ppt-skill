# QuickerWrite Dashi 隔离 Runner

## Incremental page protocol (runner v3)

POST /v1/jobs accepts protocol_version=1.0, incremental=true, a stable task_id,
planned_slides and the current ordered slides. The first request fixes the session
theme. Each page has a content revision; unchanged pages reuse engine-owned cached
render output. Requests for the same task are serialized. Cache files survive runner
restart. A changed page invalidates only that page; finalization reuses the last
published file when no content changed.

The legacy native incremental path supports `outputs: ["pptx"]`. Requests that
include HTML use the HTML-first path described below, persist the complete deck,
and then report page readiness; they do not claim native page-cache reuse.

GET /v1/jobs/{id} exposes ordered pages entries with type=page_ready, page,
revision, reused, sequence and download_url. GET /v1/jobs/{id}/pages/{page} serves
an immutable cumulative snapshot ending at that page. Cached Dashi pages have no
new snapshot URL; their output is included in the job's assembled PPTX. Page events
are emitted only after native page rendering/persistence succeeds.

The health response advertises capabilities.incremental_pages and page_cache.
The implementation remains in this AGPL fork. No Go API or Python Worker models, user records,
storage credentials or QuickerWrite source modules are imported. The public JSON
protocol and returned artifacts are the only integration boundary. Modified source
is included in the existing /source/archive offer.

Runner 始终保留在 Dashi 的 AGPL-3.0 仓库中，对外提供 QuickerWrite 中立 JSON
v1 协议。QuickerWrite 的引擎锁文件固定本仓库版本，构建和部署编排负责提供
独立的 PPT 引擎服务。Go API 与 Python 文档 Worker 只通过内部 HTTP 协议调用，
不导入 Dashi 运行时代码；部署边界以服务端仓库为准。

## 本 fork 的修改

- 增加异步中立 v1 作业提交、轮询，以及 HTML/可编辑 PPTX 下载。
- 增加可选 HMAC-SHA256 请求认证和五分钟防重放窗口。
- 将中立 slide DTO 映射到 Dashi brief、goal、安全属性和原有主题渲染器。
- 保留 12 套主题运行时，并使用原生 PptxGenJS 适配；删除 Runner 不调用的
  布局查询、检查器、交互预览启动器和重复验证 CLI。
- 每页只保留一个已选布局，避免为不存在的候选选择器生成三套候选。
- 生产镜像只包含运行时、预览图、Runner、许可和对应源码元数据。
- 使用 PptxGenJS 原生文字、形状和图表替代 Chromium/Playwright 截图导出，
  不安装浏览器、OpenSSL 或旧专有导出器。
- 预览仅开放 QuickerWrite 实际声明的 ID，源码链接指向本地 `/source`。

## 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `POST` | `/v1/jobs` | 提交中立 v1 演示文稿任务 |
| `GET` | `/v1/jobs/{id}` | 查询任务状态 |
| `GET` | `/v1/jobs/{id}/artifacts/{html,pptx}` | 下载产物 |
| `GET` | `/v1/previews/{theme-grid,hero-result}` | 读取仓库本地预览 |
| `GET` | `/source`、`/source/archive` | 提供 AGPL 对应源码 |

以下独立容器只用于此 AGPL 仓库的开发调试，不是 QuickerWrite Compose 中的独立
服务：

```bash
docker build -f quickerwrite-runner/Dockerfile -t dashi-ppt-runner:local .
docker run --rm -p 127.0.0.1:5802:8080 \
  -e QW_RUNNER_SHARED_SECRET=change-me \
  dashi-ppt-runner:local
```

预览读取本仓库的 `theme-style-grid.png`，运行时不依赖 GitHub 图片。`auto`
根据标题从 12 套主题中选择，也可直接指定 `theme01` 至 `theme12`。默认 HTML 使用中立内容与现有主题配置，保持自包含、静态和可转换。
Worker 依据该 HTML 的实际浏览器布局输出可编辑 PPTX。显式 native PPTX 请求
保留旧导出方式；它与 HTML 转换路径不同，不能用其结果冒充 HTML 转换产物。

## HTML-first conversion

Requests containing `outputs: ["html"]` now render a self-contained deck from
neutral content with `quickerwrite-runner/html.mjs` and the existing Dashi theme
profiles. This path does not use unfilled sample theme props or lazy JavaScript
hydration. Text, lists, tables and embedded images come from the request; page
notifications are emitted only after the HTML has been persisted. The Worker
converts that HTML into editable PPTX, renders the actual PPTX, and performs visual
review. Precision repairs patch the existing PPTX rather than rerunning Dashi.
The explicit native PPTX export remains available for legacy callers. Package
`html.mjs` with `server.mjs` when publishing this fork.
