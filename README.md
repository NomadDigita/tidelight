<div align="center">
  <img src="./public/tidelight-mark.svg" alt="Tidelight" width="64" height="64" />
  <h1>Tidelight</h1>
  <p><strong>See the signal between sessions.</strong></p>
  <p>Follow a market story from the event, to its evidence, to the assets it may touch.</p>
  <p>
    <a href="https://tidelight.app"><strong>Explore Tidelight ↗</strong></a>
    &nbsp; · &nbsp;
    <a href="https://tidelight.app/markets">Browse markets</a>
    &nbsp; · &nbsp;
    <a href="https://tidelight.app/research">Start a research brief</a>
    &nbsp; · &nbsp;
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

<br />

<p align="center">
  <img src="./docs/readme-assets/tidelight-macbook.png" alt="Tidelight's DYOR experience: a glowing market signal connects evidence to the Tidelight mark." width="100%" />
</p>

<p align="center"><sub>A calmer research desk for the hours between headlines.</sub></p>

---

## Make sense of the story behind the price

A company update, a policy decision, or a shift in another sector can move a market while the usual headlines are quiet. Tidelight gives you one place to ask what changed, inspect the source, and follow the possible connections.

**The Tidelight method:** Event → Evidence → Exposure → Scenario → Your decision.

Ask in everyday language. Bring a source. See what supports the story, what pushes back, and which tokenized equities may be affected. The goal is a clearer view you can question—not a signal that tells you what to buy or sell.

## Start with what matters to you

| You want to… | Start here |
| --- | --- |
| See tokenized US equities and public market prices | [Market map](https://tidelight.app/markets) |
| Ask a company or market question and review the sources | [Research desk](https://tidelight.app/research) |
| Follow the companies you care about | [Watchlist](https://tidelight.app/watchlist) |
| Compare an idea against historical market data | [Strategy Lab](https://tidelight.app/strategies) |
| Explore a bounded, paper-only market watcher | [Nightwatch](https://tidelight.app/nightwatch) |
| Rehearse a stock-perpetual idea without exchange orders | [Futures paper desk](https://tidelight.app/futures) |

You can explore public market pages without an account. Sign in to keep private briefs, watchlists, saved research, and paper ledgers with your account.

## One connected way to do your research

### Follow the evidence

Tidelight links claims to the source material used in a brief. Open the source, check its date, and compare evidence that may challenge the first read. Mini offers a concise explanation; Pro shows more of the claims, context, confidence, and scenarios behind it.

### Understand possible exposure

Connect an event to issuers, sectors, and tokenized instruments. Market hours, liquidity, and issuer terms can differ across assets, so Tidelight keeps those details in view when available.

### Rehearse decisions with clear limits

Strategy Lab replays a baseline against historical public candles. Nightwatch and the Futures Paper Desk record simulated decisions, assumptions, and risk limits in separate paper accounts. These tools help you study a process; past or simulated outcomes do not predict what comes next.

## Built to keep the boundaries clear

- **Prices have context.** Public Bitget quotes are shown with available freshness and market information. A feed can be delayed, unavailable, or different from another venue.
- **Sources remain inspectable.** A research brief is an aid to review. It does not independently verify every statement in an outside article.
- **Private work stays private.** Signed-in briefs, preferences, watchlists, and ledgers are protected by account-scoped database policies.
- **Paper means paper.** Nightwatch and the Futures Paper Desk simulate activity. They do not place exchange orders, hold assets, or manage customer funds.
- **You stay in control.** Tidelight is an informational research product, not financial advice or a recommendation. Check original sources and your own circumstances before acting.

## Project at a glance

| | |
| --- | --- |
| **What it is** | An evidence-first market research desk for tokenized US equities |
| **Who it is for** | Curious investors, researchers, and market watchers |
| **Live product** | [tidelight.app](https://tidelight.app) |
| **Repository** | [NomadDigita/tidelight](https://github.com/NomadDigita/tidelight) |
| **Market data** | Public Bitget market feeds; SEC issuer filings; optional Finnhub analyst-target aggregates |
| **AI research** | Server-side Bitget Qwen and Gemini integrations |
| **Privacy** | Supabase Auth and owner-scoped PostgreSQL policies |
| **Built with** | Next.js, TypeScript, and Supabase |
| **Live trading** | Disabled. Paper activity is simulated. |

Prices, coverage, and provider availability may change. Finnhub is an optional source for aggregate analyst targets; its free plan can have usage limits. If the data is unavailable, Tidelight should say so rather than invent a target.

## For people who want to build with us

The product is easiest to understand by exploring the live app first. If you want to run a local copy, improve a flow, or inspect the implementation, the notes below are for you.

<details>
<summary><strong>Run Tidelight locally</strong></summary>

You will need Node.js, npm, and access to a Supabase project.

```bash
npm ci
cp .env.example .env.local
```

Add the Supabase URL and publishable key to `.env.local`. Server-side AI features can use the provider keys documented in [`.env.example`](./.env.example). Keep secret keys on the server; never add them to a `NEXT_PUBLIC_` variable or commit them to Git.

Then start the app:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). Useful checks are `npm run typecheck`, `npm run lint`, and `npm run build`. Database changes are in [`supabase/migrations`](./supabase/migrations); the policies keep signed-in records scoped to their owner.

Quarterly and annual issuer facts come from SEC EDGAR. Finnhub analyst-target aggregates require the server-only `FINNHUB_API_KEY`; provider quotas and coverage apply. Passkey sign-in remains hidden until the production Supabase Auth provider and relying-party domain are configured.

</details>

## The work ahead

Tidelight is being built with a simple standard: show the evidence, label assumptions, preserve uncertainty, and keep simulations visibly separate from real trading. Follow the [product plan](./PROJECT_PLAN.md) and [current milestones](./docs/NEXT_BUILD_MILESTONES.md), or [open an issue](https://github.com/NomadDigita/tidelight/issues) with a confusing moment, a missing source, or an idea that would make the desk more useful.

<div align="center">
  <br />
  <strong>Read the story. Check the evidence. Keep your bearings.</strong>
  <br /><br />
  <a href="https://tidelight.app">Made for the hours between headlines · Tidelight ↗</a>
</div>

For technical contributions or responsible security reports, contact [security@tidelight.app](mailto:security@tidelight.app).
