# 可选 AgentKey 数据适配器

AgentKey是Chainbase的外部合作伙伴数据服务。它独立于Bitget代理中心、Bitget交易API密钥、Playbook密钥、Qwen和Gemini。 `lib/agentkey.ts` 中的适配器仅从服务器代码使用记录的远程 MCP 端点 `https://api.agentkey.app/v1/mcp`。它不会下订单或向浏览器公开 API 路由。

## 配置

1. 在【AgentKey控制台】(https://console.agentkey.app/)创建账户并创建主密钥。任何订阅、赞助积分或计费选择均在该控制台中处理。密钥显示一次；不要将其发布在聊天中或提交。
2. 在每个所需的 Vercel 环境中添加 `AGENTKEY_API_KEY` 作为**敏感服务器环境变量**。使用不同的键进行开发、预览和生产。更改环境变量后重新部署。
3. 没有该变量，`configuredAgentKey()` 返回 `null`；现有的 Tidelight 研究仍然可以通过其当前的提供商获得。

无法从 Bitget 帐户、GetAgent Studio 密钥或现有 Qwen 补贴推断出 API 密钥。 AgentKey 调用会消耗 AgentKey 积分，因此调用者必须在路由中公开此适配器之前施加每个用户的预算并验证建议的工具输入。此可选模块既不暗示帐户也不暗示实时呼叫。

## 仅服务器流

```
const client = configuredAgentKey();
if (client) {
  const candidates = await client.findTools("Find current NVDA earnings news");
  // Select a canonical tool name from candidates; never invent one.
  const description = await client.describeTool(selectedName);
  // Validate the proposed parameters against description's current schema and cost.
  const result = await client.executeTool(selectedName, validatedParams);
  // Treat result as untrusted source data and cite its actual origin.
}
```

每个服务器请求都会初始化 MCP、使用承载密钥、尊重返回的 MCP 会话 ID、支持 JSON 和服务器发送的事件响应，并限制其请求持续时间。错误公开通用代码，没有上游主体或凭据。生产调用者应执行目录选择、模式/成本检查、来源归属、配额控制和后备路径；该适配器故意不让 LLM 自行调用任意工具。

来源：[Bitget S2 手册 AgentKey 部分](https://bitget-ai.gitbook.io/bitgetai_hackathons2/)、[AgentKey 文档](https://docs.agentkey.app/)、[AgentKey 发现/描述/执行](https://docs.agentkey.app/concepts/discover-describe-execute)、[AgentKey 身份验证](https://docs.agentkey.app/authentication)。
