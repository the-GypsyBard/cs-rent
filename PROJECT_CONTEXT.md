# 给下一位维护者的项目交接

CURRENT_VERSION: 0.8.0

更新：2026-09-18。本文件是项目入口，配合 [维护约定](AGENTS.md) 与 [变更记录](CHANGELOG.md) 阅读。当前为可运行的 Electron 交互原型，**本轮等待用户验收**，不是全部生产功能已交付。

## 目录与启动

- 当前仓库 `CS饰品平台`，origin 为 https://github.com/the-GypsyBard/cs-rent.git；2026-09-18 用户明确要求提交并推送当前项目。仓库根目录对应此目录，沿用原始提交历史，以 v0.8 源码替换旧项目；父目录文档、示例、验收和 release 不纳入本次提交。不要用 git reset 恢复旧项目。
- 父目录 `D:\工作区、数据\codex\项目\CS2饰品租赁`；`docs` 仅保留最新需求、架构、设计与核实报告；`验收` 放最新验收；`归档` 保存被替代文档；`验证记录` 存证据。
- **发布目录是 `../release`**，已由项目内移动至父目录。electron-builder 输出 `../release`；`启动原型.cmd` 启动 `%~dp0..\release\win-unpacked\CS饰品平台-交互原型.exe`，必须 CRLF。整个 win-unpacked 可独立复制运行，不依赖源码、docs、归档或本机 CS2。
- 通用 NSIS 安装包只包括 `out/**/*`、package.json 和 Electron 运行库；不带真实用户数据。不要更改 appId、app.setName 或卸载保留数据配置。
- 真实用户数据在 `%APPDATA%\CS饰品平台-交互原型\workspace-v2.json`，以设置显示的位置为准。不得把它复制到发布包或测试目录，也不要用演示数据覆盖它。

## 用户已确定的关键口径

- 专业资产工具，浅色/护眼深色可切换并持久化。先完成主要交互原型验收，再继续迭代；一次只问一个问题，最后一个确认要提示。
- 租金按**订单完成结算日期**记入当天。每日图与累计图共用 7 天、15 天、1 月、3 月、6 月、1 年、自定义范围。累计图含区间之前的期初值；没有结算日期的旧记录不猜日期，保留缺失提示。
- 收藏按涂装计，任意版本/磨损拥有即点亮；重复、双版本只计一次，纪念品计总数；枪械普通与 StatTrak™ 独立进度。刀具按刀型、手套按代数。刀具 StatTrak™ 拥有才显示拥有标记。所有多普勒款式合并为一款进度，分别显示具体款式拥有状态。
- 收藏分武器箱、收藏品；武库单独栏目含当前/历史投放与限定物品。发行时间默认从新到旧，支持反序及放大选择。目录由用户手动刷新后自动接纳新内容。
- “已停止投放”指退出明确的官方渠道，不表示不可能返场。客户端仍保留历史饰品，不能凭定义存在判断全渠道状态，更不能猜停投日期。
- 收藏报价默认该皮肤**支持的最低磨损等级**（有崭新选崭新，否则继续向后）。多普勒没有“普通版”这个款式：全部款式同步切换磨损，主行取这些款式最低价；质量选项“非 StatTrak™”与款式是不同维度。部分缺价时标明范围不完整。
- 手动资产自动估值须同款、同版本、同磨损，缺价待估值；手动覆盖允许。款式未获独立报价不能用基础多普勒报价。人民币金额内部用整数分；磨损/渐变率字符串保留输入精度。
- 受赠成本零、无所属平台、无购买订单。公共收支按平台总项→自定义收入/支出子项；支持设置总额、增加金额，保留完整调整历史。
- 完整备份可迁移资产、订单、愿望、实际属性、估值、公共子项历史、个人设置、目录。验证预览后恢复，保存原文件副本；错误备份不写入。

## 代码地图

| 入口 | 职责 |
|---|---|
| src/main/index.ts | Electron 窗口、IPC 及发送者校验；数据、目录、报价、外链服务 |
| src/main/workspace-service.ts | 权威账本，队列写入/pending/fsync/rename；恢复前副本；损坏主文件保护 |
| src/shared/user-data.ts | workspace schema v2、旧 v1 迁移及金额/ID/关联校验 |
| src/main/catalog-service.ts / src/shared/catalog.ts | 固定 revision 目录刷新、Zod 验证、缺条目拒绝覆盖；备份读入时自动识别限定物品 |
| src/shared/availability.ts | VDF 重复键解析、当前武库配置、官方公告证据与历史；限定 lootlist 兼容归类 |
| src/main/market-service.ts / src/shared/market.ts | SteamDT 官方 OpenAPI 报价与平台 ID；CollectionQuoteService 缓存和并发限制；steamdt-api.ts 管理主进程请求与加密凭据 |
| src/shared/presentation.ts | 多关键词/标点归一化搜索、中文款式显示、磨损排序；不更改原始 ID |
| src/renderer/src/catalog-store.tsx / store.tsx | 目录上下文和用户状态；桌面主进程优先，旧 localStorage 兼容 |
| src/renderer/src/pages/Collection.tsx / CollectionPrice.tsx | 收藏分组、搜索、拥有进度、可见行报价及款式矩阵 |
| pages/Assets.tsx / Wishlist.tsx / AssetAttributes.tsx | 资产档案与外链、手工属性、愿望条件与模糊检索 |
| src/renderer/src/rental-chart.ts / pages/PublicSubitems.tsx | 结算日与累计图；公共收支子项 |

App 保留所有页面在 DOM 中，用 hidden 切换。CollectionPrice 必须同时满足页面 active 和 IntersectionObserver 可见才请求；异步响应按 skinId/wear/version/revision/tick 隔离。报价只存内存，不修改用户库存估值。

## 数据源与当前限制

- 目录：ByMykel/CSGO-API；投放：GameTracking-CS2 的游戏资源与 Valve 官方 Steam 公告。稳定 source ID 保留，knife finishKey 合并款式；snapshot schema 仍为 1，workspace schema 仍为 2。
- 限定物品当前 4 款（XM1014 幽独、沙鹰热处理、M4A1 幽独、AK 爱神），同属 collection-set-xpshop-wpn-01。内置资源版本下无现役限定兑换项，确切停投日缺证据则待核实。未来多个限定 lootlist 可映射社区聚合分组；“分组可获取”只表示至少一款，不等同全部历史饰品在售。
- SteamDT 集成只使用 https://open.steamdt.com 文档接口：single 在售报价、kline 独立款式收盘参考、base 商品映射；不解析网页或调用网页私有接口。单价接口不支持款式，**多普勒收盘参考价不等于当前最低在售价**。7 天内的最新有效收盘列可显示，过期缺失则待获取；主行取已取得款式参考价最低值并标明是否完整。
- 2026-09-18 使用用户授权密钥实测：蝴蝶刀伽玛多普勒绿宝石 API 独立款式 K 线成功。基础信息 API 返回 4005（当日额度已用完），价格/K 线正常，平台链接可用价格 API 商品 ID。不可把 base 完整下载写成已验证通过。
- 密钥由 Electron safeStorage（Windows DPAPI）加密存为 userData/steamdt-credentials.json，仅主进程读写；设置不回显原密钥。密钥不进入账本、备份、源码、日志或安装包。steamdt-base-cache.json 保存公开映射和每日尝试时间；base 每日一次，价格本地每分钟最多 55 次，K 线最多 110 次。搬家需重新填密钥。
- SteamDT 款式按钮打开对应涂装与磨损商品页，公开链接没有可靠款式预选参数，需要用户在网站选择款式。
- 原型尚未接通平台账号/订单采集、愿望单定时自动刷新；正式 SQLite、精确年化、Excel 导入及干净系统安装/升级/卸载端到端验证仍未完成。新目录图片可能依赖联网，备份不打包浏览器缓存。

## 开发验证与交付流程

标准命令：`npm ci`、`npm run dev`、`npm run typecheck`、`npm test`、`npm run build`、`npm run package:win`。本机 Node 24.19.0、pnpm 可用，无全局 npm，可用 `pnpm --package=npm dlx npm exec -- electron-builder --win nsis --x64` 打包；直接运行 node_modules 下的 tsc/vitest/electron-vite 可避开全局 npm。

1. 修改后更新本文件和 CHANGELOG；需要时提升文档版本、归档旧版并更新引用；验收保持独立目录。
2. 类型检查；`node node_modules/vitest/vitest.mjs run`。v0.8 目前 53 条单测。
3. 构建后 `node scripts/refinement-smoke.mjs`（本轮 UI，固定报价），`node scripts/migration-smoke.mjs`（完整迁移）；必要时 smoke、iteration-smoke、followup-smoke、collection-smoke 回归相关行为。
4. `official-api-smoke.mjs` 验证隔离账本交互；`verify-official-api.mjs` 用本机授权密钥验证真实接口，仅内存读取凭据。旧 verify-live-* 入口已转发到官方 API 验证；证据在 artifacts/api-research-v08（无密钥）。联网可能失败，应如实记录而非用测试值冒充。
5. `node scripts/check-project-context.mjs`；`node scripts/check-documents.mjs`（父目录文档存在的此工作区使用）。重新生成 ../release 后运行 audit-runtime.mjs、check-package.mjs，核对包版本、空账本与主题重启。
6. 运行真实用户启动脚本供验收，只观察既有数据，不主动载入演示；最终说明完成项、限制、测试结果及验收入口。不得自动提交 GitHub。

检查输出位于 artifacts（gitignore，非运行依赖）；最新结论记录在父目录验收文档。测试配置环境变量只对开发版生效，打包版需显式 --user-data-dir。没有必要反复跑全套；对新修改和失败有针对性复验。

## v0.7 最后验证结果

45 条单测通过；refinement、migration、followup、iteration UI 回归通过；普通真实报价与多普勒缺价保护通过。NSIS 构建完成到 ../release，包审计仅含 out/package.json（45 条目、33 张内置图片），打包版空账本和主题多次重启通过。55 份文档、383 个本地链接全部有效。独立实时款式价仍未接通，用户验收仍待确认。

实际启动脚本也已验证，新路径启动成功；启动前后真实账本业务记录及设置哈希一致。

启动诊断补充：自动化用 Hidden 窗口方式启动曾出现空白；正常窗口方式运行同一启动脚本后，原用户空间的 v0.7 界面、深色主题和账本均显示正常。只读启动诊断无 renderer 错误；没有清缓存或重置账本。后续验收按正常双击路径进行，不要把隐藏启动异常误认为数据损坏。

## v0.8 本轮变更与验收入口

- 多普勒显示 P1、P2、P3、P4、红宝石、蓝宝石、黑珍珠；伽玛为 P1–P4、绿宝石；原始 phase 和 skinId 保持稳定。
- 报价来源 SteamDT、平台名称分别可点击；资产档案的收藏品链接可定位、滚动及高亮对应收藏涂装。
- 收藏室增加“同步投放状态”；API 官方公告识别终端每周掉落和明确移除，限定单件展示停投时间（缺证据不猜日期）。全目录 94 组枪械/武器箱/限定分组已核对，24 组有至少一个渠道证据、70 组缺充分证据。
- 愿望单可手动通过官方 API 刷新 BUFF/悠悠有品/IGXE 在售价；款式收盘参考价不混入当前在售价及达标判断。
- 设置可安全配置、移除密钥、测试连接和按日同步商品基础信息。
- 最终验证：类型检查、53 单测、official-api/refinement 界面、完整迁移通过；真实 API 两组全部款式及磨损切换和平台链接通过。NSIS v0.8.0 已更新到 ../release，包审计 45 条目/33 张内置图，只含 out 与 package.json；全新用户无账本/密钥，主题重启通过。正常运行启动脚本显示成功，既有业务数据和设置哈希一致。用户验收仍待确认。

`verify-availability-sync.mjs` 已通过真实官方源同步 IPC（隔离账本），94 组目录成功且业务记录/设置不变。最新文档 62 份、本地链接检查通过。v0.7 报价核实原报告已从本任务原始写入记录完整恢复归档；当前 docs 保留 v0.8 官方 API 报告。
