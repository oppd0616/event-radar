# 开发工具索引

日常开发优先使用当前目录的验证、部署、同步与审核工具。历史脚本集中存放，避免误把旧数据修复程序当作常规入口。

| 位置 / 名称 | 用途 | 使用条件 |
| --- | --- | --- |
| `verify-*` | 单元、规则与页面逻辑验证 | 部分依赖已安装的云函数依赖；部分依赖历史数据 |
| `audit-*`、`inspect-*` | 数据质量、队列、运行与用户状况检查 | 先阅读脚本，云端工具需自己的环境与登录 |
| `deploy-cloud.ps1` | 常规云函数部署 | 先配置自己的云环境；根目录 deploy-cloud.cmd 调用此入口 |
| `deploy-cover-security.cjs` | 定向部署封面网络防护 | 专项维护工具，运行会更新云函数 |
| `sync-*` | 同步共享代码到各使用方 | 运行可能改写工作区文件 |
| `event-dashboard-server.cjs` | 本地看板服务 | 本地快照、CloudBase CLI 运行组件另行准备 |
| `dashboard-cloudbase-cli.cjs` | 定位本地 CloudBase CLI | 共享模块，保留原路径供其他脚本使用 |
| `github-repository.cjs` | 查看仓库状态或按参数公开仓库 | 需要 GitHub 登录；public 参数会改变可见性 |
| `archive/` | 历史来源试验、专项核验、一次性修复与迁移 | 非日常入口，不应直接对生产环境批量运行 |
| `assets/` | 宣传图、产品介绍与参赛材料生成 | 依赖未提交的历史素材、工具或本机路径 |

## 不依赖历史快照的验证示例

在仓库根目录运行，按需安装被测模块依赖：

```bash
node scripts/verify-cover-network.cjs
node scripts/verify-product-audience.cjs
node scripts/verify-event-write-quality.js
node scripts/verify-candidate-scheduler.cjs
```

## 使用边界

- `verify-*-cloud`、`*-live` 等名称通常涉及云端，不等同于离线测试。请阅读实现确认是否会写入。
- 归档保留开发依据，不承诺能在干净克隆中独立运行。日期、具体活动、云环境和历史输出常是固定值。
- 历史 `docs/`、`output/` 数据未提交，素材生成还可能依赖本机浏览器或 Python 环境。
- 保留原位置的工具可能被测试、看板或部署命令引用，移动前需检查调用关系。
