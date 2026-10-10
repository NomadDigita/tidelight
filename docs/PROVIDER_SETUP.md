# Tidelight provider setup

## Bitget Agent Hub (recommended for personal trading)

Bitget's current Agent Hub uses a browser OAuth flow and an isolated Agentic account. It does not require pasting a Bitget API secret into an AI chat.

1. Open the official Agent Hub documentation: https://www.bitget.com/docs/uta/agent-hub
2. Complete the Bitget Agentic-account OAuth flow.
3. Keep the Agentic balance isolated and only transfer an amount you can afford to lose.
4. For Tidelight's in-app trading desk, use the Tidelight Trading connection form instead of placing credentials in chat.
5. Never enable withdrawal permission. Prefer IP restrictions and the smallest possible trading scope.

## Bitget API credentials for Tidelight

Create these in Bitget API Key Management:

- API key
- Secret key
- Passphrase

Use read/trade permissions only. Do not enable withdrawals. Tidelight encrypts the credentials server-side and requires validation, explicit order confirmation, live-mode MFA, and order limits before routing an order.

## Qwen build credits / hackathon gateway

The hackathon handbook describes Qwen credits as an application process, not a public self-service key:

1. Apply through the Qwen Token application form: https://forms.gle/2QeJpvGB5VpipqQ68
2. Complete Bitget KYC.
3. Bitget reviews KYC status periodically.
4. If approved, collect the credit/token details from an administrator in the official community: https://t.me/+o1tYqQ_lXxllYjgy
5. If the admin provides a gateway bearer token for the hackathon endpoint, place it in Vercel as `BITGET_QWEN_API_KEY` with Production and Preview targets.
6. Never commit it, expose it in a `NEXT_PUBLIC_*` variable, or paste it into chat.

If no gateway token is issued, Tidelight's Token Pulse will remain safely disabled rather than silently using an unapproved provider.

### Diagnosing a provider run

In Settings, **Check AI availability** performs a small authenticated JSON request to each configured provider and reports the model listing and call result. It does not prove that a larger research request will finish before the Agent Flow deadline. On October 10, 2026, production checks returned a valid response from both Bitget Qwen `qwen3.8-max` and Gemini `gemini-3.5-flash-lite`; neither model was discontinued for those configured keys at that time. Alibaba's [model catalog](https://www.alibabacloud.com/help/en/model-studio/text-generation-model) and Google's [model catalog](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) also list them. Google's [rate limit guidance](https://ai.google.dev/gemini-api/docs/rate-limits) says capacity depends on the project and current tier, so a later 429 still needs an account-specific check.

Server logs record `ai-provider-http` with a bounded, redacted status/detail, `ai-provider-invalid` with response shape and finish metadata (no prompt or output), or `agent-flow-ai-unavailable` with a provider failure code. A 503 or timeout on the full source prompt is different from a missing key or retired model. The flow fails closed: without a validated source-bound assessment it offers no trade handoff.

## Vercel configuration

Already configured for Tidelight:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `BITGET_CREDENTIALS_ENCRYPTION_KEY`

Still provider-dependent:

- `BITGET_QWEN_API_KEY`
- User-specific Bitget API key, secret, and passphrase

Set provider credentials in Vercel Project Settings → Environment Variables, mark them sensitive, and redeploy after saving.
