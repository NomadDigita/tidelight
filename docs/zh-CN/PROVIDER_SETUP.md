# Tidelight 提供商设置

## Bitget 代理中心（推荐用于个人交易）

Bitget 的当前代理中心使用浏览器 OAuth 流和隔离的代理帐户。它不需要将 Bitget API 秘密粘贴到 AI 聊天中。

1.打开Agent Hub官方文档：https://www.bitget.com/docs/uta/agent-hub
2. 完成 Bitget 代理账户 OAuth 流程。
3. 保持 Agentic 余额隔离，仅转移您可以承受损失的金额。
4. 对于 Tidelight 的应用内交易台，请使用 Tidelight 交易连接表单，而不是在聊天中放置凭据。
5. 切勿启用提现权限。更喜欢IP 限制和尽可能小的交易范围。

## Bitget API Tidelight

在 Bitget API 密钥管理中创建这些：

- API 密钥
- 密钥
- 密码

仅启用读取和交易权限，切勿启用提现权限。 Tidelight 在服务器端对凭证进行加密，并在发送订单之前要求进行验证、显式订单确认、实时​​模式 MFA 和订单限制。

## Qwen 构建积分/黑客马拉松网关

黑客马拉松手册将 Qwen 积分描述为申请流程，而不是公共自助服务密钥：

1.通过Qwen Token申请表进行申请：https://forms.gle/2QeJpvGB5VpipqQ68
2. 完成 Bitget KYC。
3. Bitget 定期审核 KYC 状态。
4. 如果获得批准，请向官方社区管理员收集积分/代币详细信息：https://t.me/+o1tYqQ_lXxllYjgy
5. 如果管理员为黑客马拉松端点提供网关承载令牌，请将其作为 `BITGET_QWEN_API_KEY` 放置在 Vercel 中，并包含生产和预览目标。
6. 切勿提交、将其公开在 `NEXT_PUBLIC_*` 变量中或将其粘贴到聊天中。

如果没有颁发网关令牌，Tidelight 的令牌脉冲将保持安全禁用状态，而不是默默地使用未经批准的提供商。

### 诊断提供程序运行

在“设置”中，**检查 AI 可用性**向每个配置的提供程序执行一个小型的经过身份验证的 JSON 请求，并报告模型列表和调用结果。它并不能证明更大的研究请求将在代理流截止日期之前完成。 2026年10月10日，生产检查从Bitget Qwen `qwen3.8-max`和Gemini `gemini-3.5-flash-lite`返回有效响应；当时，对于这些配置的密钥，这两种型号都没有停产。阿里巴巴的[型号目录](https://www.alibabacloud.com/help/en/model-studio/text-generation-model)和谷歌的[型号目录](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)也列出了它们。 Google 的[速率限制指南](https://ai.google.dev/gemini-api/docs/rate-limits) 表示容量取决于项目和当前级别，因此后续的 429 仍需要针对特定​​帐户进行检查。

服务器日志记录带有限制的、经过编辑的状态/详细信息的 `ai-provider-http`、带有响应形状和完成元数据（无提示或输出）的 `ai-provider-invalid` 或带有提供程序故障代码的 `agent-flow-ai-unavailable`。完整源提示中的 503 或超时与丢失密钥或退役模型不同。流程无法关闭：如果没有经过验证的源头限制评估，它就无法提供交易交接。

## Vercel配置

已为 Tidelight 配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `BITGET_CREDENTIALS_ENCRYPTION_KEY`

仍然依赖于提供商：

- `BITGET_QWEN_API_KEY`
- 用户特定的 Bitget API 密钥、秘密和密码

在 Vercel 项目设置 → 环境变量中设置提供程序凭据，将其标记为敏感，并在保存后重新部署。
