# Dashi npm 发布目录

此目录保存 `dashi-ppt-skill` npm 包的发布源文件：

- `install.mjs`：`npx dashi-ppt-skill` 使用的安装入口，发布时保持原样。
- `publish-npm-skill.mjs`：组装并发布 npm 包；内容由本目录安装器与仓库
  `skills/dashi-ppt/` 合并，安装时把 `project/npmrc.template` 生成为 `.npmrc`。

每次发布都从开发仓库同步这些文件。QuickerWrite 内置 Runner 的部署镜像不会包含
npm 发布脚本；该目录仅服务于 Dashi 独立 AGPL 仓库自己的发行流程。
