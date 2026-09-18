# CS 饰品平台 · v0.8

本地 Windows Electron 交互原型。运行 [启动原型.cmd](启动原型.cmd)；通用安装包与 win-unpacked 在 [上一级 release](../release)。Git 关联 the-GypsyBard/cs-rent，仓库根目录对应本地 `CS饰品平台`。父目录文档与 release 不在本仓库内；新克隆后先安装依赖并构建或打包。

已接入 SteamDT 官方 OpenAPI：普通最低在售价、多普勒独立款式收盘参考价、平台商品链接。收藏支持 P1–P4/宝石排序、资产档案定位、手动同步投放。设置中管理 Windows 加密密钥；不会把密钥或账本放入源码和安装包。

首次维护先读 [AGENTS](AGENTS.md)、[PROJECT_CONTEXT](PROJECT_CONTEXT.md)、[CHANGELOG](CHANGELOG.md)。[最新文档](../docs/README.md)、[v0.8 验收](../验收/验收指南_v0.8.md)和[逐项投放清单](../docs/全目录投放状态与手动同步方案_2026-09-18.md)在项目外。

开发：npm ci、npm run dev、npm run typecheck、npm test、npm run build、npm run package:win。本机无全局 npm 时可直接调用 node_modules 中的入口，具体命令见交接文档。

用户账本独立保存在系统 userData，通过完整备份导入/导出迁移；密钥在新电脑重新配置。运行不依赖 docs、归档脚本、本机 CS2 安装或工程工作目录。完整运行文件夹可复制使用。平台订单采集仍为演示；本轮用户验收待确认。
