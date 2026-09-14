# QuickerWrite Dashi 隔离 Runner

## Incremental page protocol (runner v3)

POST /v1/jobs accepts protocol_version=1.0, incremental=true, a stable task_id,
planned_slides and the current ordered slides. The first request fixes the session
theme. Each page has a content revision; unchanged pages reuse engine-owned cached
render output. Requests for the same task are serialized. Cache files survive runner
restart. A changed page invalidates only that page; finalization reuses the last
published file when no content changed.

Incremental requests support `outputs: ["pptx"]` only; other formats are rejected
explicitly. The ordinary non-incremental mode continues to support HTML and PPTX.

GET /v1/jobs/{id} exposes ordered pages entries with type=page_ready, page,
revision, reused, sequence and download_url. GET /v1/jobs/{id}/pages/{page} serves
an immutable cumulative snapshot ending at that page. Cached Dashi pages have no
new snapshot URL; their output is included in the job's assembled PPTX. Page events
are emitted only after native page rendering/persistence succeeds.

The health response advertises capabilities.incremental_pages and page_cache.
The implementation remains in this AGPL fork. No Django models, user records,
storage credentials or QuickerWrite source modules are imported. The public JSON
protocol and returned artifacts are the only integration boundary. Modified source
is included in the existing /source/archive offer.

Runner 始终保留在 Dashi 的 AGPL-3.0 仓库中，对外提供 QuickerWrite 中立 JSON
v1 协议。QuickerWrite 将本仓库克隆到 `api/ppt_engines`，由 Django API 启动链
自动托管；部署者无需单独启动，也不填写 Runner URL。商业核心只通过固定内部
HTTP 端点调用，不导入 Dashi 运行时代码。

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
根据标题从 12 套主题中选择，也可直接指定 `theme01` 至 `theme12`。HTML 与
PPTX 使用同一份中立内容；HTML 保留交互主题，PPTX 用原生 Office 图元尽量保持
配色、层级、构图节奏和主题装饰。CSS 动画和滤镜无法逐像素写入 OOXML，但不会
以牺牲可编辑性为代价伪造一致性。
