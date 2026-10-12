# Tidelight 操作手册

## 服务状态

- `/systems` 是品牌操作员视图。
- `GET /api/system/health` 返回请求 ID、部署 SHA、响应时间、Bitget 快照期限和覆盖范围以及提供程序配置标志。 “已配置”并不声明上游运行状况探测、cron 执行或 SLA。
- Bitget 市场端点显示陈旧或不可用的状态，而不是用样本值替换失败的实时数据。
- 应按路线和时间搜索 Vercel 运行时日志。将用户可见的研究或策略工件与其返回的运行 ID 相关联； Nightwatch 在每个决策中保留运行 ID。

## Nightwatch 预定纸质支票

计划路径配置为每天 09:00 UTC 一次，并且每个登录帐户和一对 Reality 选择加入。爱好计时精度为每小时，因此调用可能从 UTC 时间 09:00 到 09:59 开始。每次运行都会获取最新完成的四小时 Bitget 蜡烛图，然后 Postgres 重新检查当前选择加入、所选交易品种、暂停状态、所有者链接、重复密钥、提要新鲜度、损失上限、头寸上限和每日填充限制。它使用现有的纸质分类账。没有调用交换订单 API。

所需生产环境：

| 变量 | 获取位置 | Vercel 目标 |
|---|---|---|
| `CRON_SECRET` | 已存在于 Tidelight Vercel 项目中 | 生产 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 仪表板 → Tidelight 项目 → 项目设置 → API 密钥 → 旧版匿名，service_role API 密钥 → 复制`service_role` | 敏感，仅生产 |

切勿在 Supabase 服务角色密钥前加上 `NEXT_PUBLIC_`、提交它、将其粘贴到浏览器客户端或将其发送给第三方提供商。产品所有者报告该密钥已添加到 Vercel。下次生产部署后，确认 `/api/system/health` 报告已配置的调度程序。然后选择加入 Nightwatch。该计划在 UI 中保持禁用状态，直到两个服务器密钥都存在。

Vercel Hobby 兼容计划为每天 09:00 UTC 一次，计时精度为每小时（跑步可能从 09:00 到 09:59 UTC 开始）。这降低了自动观察的节奏；用户仍然可以随时进行手动检查。 Vercel Cron 仅调用生产部署。请参阅[Vercel Cron 使用和定价](https://vercel.com/docs/cron-jobs/usage-and-pricing) 和[保护 cron 作业](https://vercel.com/docs/cron-jobs/manage-cron-jobs)。

## 备份与恢复

尚未执行生产恢复。在进行恢复演练之前，请使用隔离的暂存项目或分支，在那里恢复最近的备份，检查迁移和所有者范围的读取，并记录恢复时间和数据丢失点。不要将恢复过度生产作为测试。 Supabase 项目所有者必须在项目仪表板中确认可用的备份保留和恢复选项，因为它们取决于当前计划。

## 事件响应

1. 从控制界面暂停用户的 Nightwatch 纸张代理；不存在实时执行路径。
2. 检查 `/systems` 是否有过时的提供程序，并记下请求 ID 并部署 SHA。
3. 检查Vercel功能日志中是否有相关路由；切勿在日志中包含 API 密钥或授权标头。
4. 如果市场源过时或不可用，请停止手动检查，直到当前已完成的蜡烛返回。
5. 在更改配置之前保留研究运行、蜡烛指纹、Nightwatch 决策和操作员操作 ID。
6. 对于帐户隔离或意外的纸质账本写入，请在 Vercel 中禁用计划的机密，并在恢复之前检查相应的 Supabase 审计记录。
