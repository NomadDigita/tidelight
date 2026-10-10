import "server-only";

export type SupportLink = { label: string; href: string };
export type SupportTopic = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  links: SupportLink[];
};

/** Product-owned, reviewable knowledge. Keep this in step with the shipped screens. */
export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "start", title: "Getting started", keywords: ["start", "begin", "new", "how does tidelight work", "what is tidelight", "first", "help"],
    answer: "Start with one market question in Research or Agent Flow. Tidelight gathers evidence, shows what supports or weakens a claim, maps the affected markets, and lets you review a scenario. The decision stays yours. The Start Here guide walks through this in four steps.",
    links: [{ label: "Start here", href: "/guide" }, { label: "Ask a market question", href: "/flow" }],
  },
  {
    id: "flow", title: "Agent Flow", keywords: ["agent flow", "agents", "checkpoint", "tradeable", "trading agent", "signal", "gate", "nvda", "tsla"],
    answer: "Open Agent Flow and ask a question about US stocks or tokenized markets. It gathers recent sources, maps the instruments, tests scenarios, and shows each checkpoint. A trading review appears only when its evidence and market gates agree. A hold means the current evidence is insufficient; it is not a trade instruction.",
    links: [{ label: "Open Agent Flow", href: "/flow" }, { label: "Read the guide", href: "/guide" }],
  },
  {
    id: "research", title: "Research desk", keywords: ["research", "brief", "citation", "source", "article", "mini", "pro", "evidence", "claim"],
    answer: "Open Research, ask a focused question, choose Mini for a simple sourced explanation or Pro for detailed evidence, and supply or select a supported source. Review the captured passage, counter-evidence, dates, and uncertainty. A matched quotation confirms only what the captured text says, not whether a publisher is trustworthy.",
    links: [{ label: "Open Research", href: "/research" }, { label: "Saved briefs", href: "/briefs" }],
  },
  {
    id: "demo-key", title: "Bitget demo API key", keywords: ["demo api", "demo key", "demo trading key", "demo account", "virtual fund", "bitget demo", "test api", "practice key"],
    answer: "To create a Bitget demo API key, log in to Bitget (complete its required identity verification), switch to Demo mode, then open Personal Center → API Key Management → Create Demo API Key. Save its API key, secret, and passphrase privately. Enable the needed read and trade permissions; leave withdrawals disabled. In Tidelight, sign in, open Trading, choose Bitget demo, enter those three values in the private connection form, and select Verify demo key. Verification checks read access without placing an order. Every demo order still needs your explicit review and confirmation. Never paste credentials into this chat.",
    links: [{ label: "Open Tidelight Trading", href: "/trading" }, { label: "Official Bitget demo setup", href: "https://www.bitget.com/docs/uta/demo-trading/rest-api" }],
  },
  {
    id: "live-key", title: "Bitget live API and safety", keywords: ["live trading", "live api", "bitget key", "api key", "connect bitget", "api secret", "withdrawal", "real order"],
    answer: "Sign in to Tidelight and open Trading. Use a dedicated Bitget key for the account mode you select, with spot trade read and write access and withdrawals disabled. Enter the API key, secret, and passphrase only in Tidelight’s private connection form. Tidelight verifies read access before storing the encrypted credential; Bitget checks write access when an order is confirmed. Each live order needs explicit confirmation and an authenticator check. Never paste a key or secret into support chat.",
    links: [{ label: "Open Trading", href: "/trading" }, { label: "Account security", href: "/settings" }],
  },
  {
    id: "orders", title: "Bitget order controls", keywords: ["order", "buy", "sell", "trade", "execution", "spot", "reality token"],
    answer: "The Trading desk offers one-off demo or live spot orders only for verified Reality stock tokens. Choose the account mode, token, side, order type, and amount; review everything before confirming. The estimated order cap is 250 USDT, and live orders require an authenticator check. A market order may execute immediately. The assistant cannot place or approve orders.",
    links: [{ label: "Open Trading", href: "/trading" }],
  },
  {
    id: "nightwatch", title: "Nightwatch", keywords: ["nightwatch", "watcher", "automated", "monitor", "alert", "paper trading", "pause", "scheduler"],
    answer: "Nightwatch monitors supported Reality markets with user-chosen limits, records decisions and simulated fills, and can show in-app alerts and summaries. Its scheduled checks are opt-in and paper-only; it never sends live Bitget orders. Check market freshness, start conservatively, and pause it whenever needed.",
    links: [{ label: "Open Nightwatch", href: "/nightwatch" }],
  },
  {
    id: "futures", title: "Stock perpetual paper desk", keywords: ["futures", "perpetual", "perp", "short", "margin", "liquidation", "stock perp"],
    answer: "The stock perpetual desk simulates long and short positions against selected Bitget stock perpetual references. The account balance and fills are paper values. Read the price timestamp and decision trail before acting elsewhere; this desk does not submit live perpetual orders.",
    links: [{ label: "Open paper futures", href: "/futures" }],
  },
  {
    id: "strategy", title: "Strategy Lab and Alpha Factory", keywords: ["strategy", "backtest", "alpha factory", "playbook", "holdout", "sma", "fee", "slippage"],
    answer: "Strategy Lab replays a fixed baseline on historical candles and shows assumptions, fees, trades, and out-of-sample results. Alpha Factory drafts and evaluates candidate playbooks with AI. Past results and AI drafts are experiments, not forecasts or approval to trade. Inspect the holdout and costs before saving a playbook.",
    links: [{ label: "Open Strategy Lab", href: "/strategies" }, { label: "Open Alpha Factory", href: "/systems" }],
  },
  {
    id: "community", title: "Research community", keywords: ["community", "tideli", "post", "message", "profile", "follow", "studio usage", "public stats"],
    answer: "The Tideli research community has a feed, member profiles, and private messages. You can share a research post and choose whether to show aggregate Studio usage on your public profile in profile settings. Usage sharing starts off; private briefs and message contents are never included in public usage totals.",
    links: [{ label: "Open community", href: "/community" }, { label: "Your messages", href: "/community/messages" }, { label: "Profile settings", href: "/settings" }],
  },
  {
    id: "account", title: "Sign-in and security", keywords: ["login", "sign in", "email", "otp", "google", "passkey", "authenticator", "mfa", "account", "security"],
    answer: "Use Sign in for Google or an email code. In Settings you can manage your profile and authenticator. Passkeys depend on the account provider and production domain being enabled; the control is hidden when unavailable. An authenticator check is required before each live Bitget order. Do not share verification codes or secrets with support chat.",
    links: [{ label: "Sign in", href: "/login" }, { label: "Account settings", href: "/settings" }],
  },
  {
    id: "markets", title: "Markets and tokenized stocks", keywords: ["market", "price", "rToken", "tokenized", "quote", "asset", "watchlist", "logo", "stock"],
    answer: "Markets shows public Bitget prices and asset information, including tokenized equity instruments where available. A token’s price and trading conditions can differ from the underlying US share. Check the source timestamp, freshness label, issuer, and market hours. Save a watchlist after signing in.",
    links: [{ label: "Explore markets", href: "/markets" }, { label: "Your watchlist", href: "/watchlist" }],
  },
];

const PAGE_TOPIC: Record<string, string> = {
  "/": "start", "/guide": "start", "/flow": "flow", "/research": "research", "/briefs": "research", "/trading": "orders", "/nightwatch": "nightwatch", "/futures": "futures", "/strategies": "strategy", "/systems": "strategy", "/community": "community", "/community/messages": "community", "/settings": "account", "/login": "account", "/markets": "markets", "/watchlist": "markets",
};

function pageTopic(pathname: string): string {
  if (pathname.startsWith("/community/")) return "community";
  if (pathname.startsWith("/markets/")) return "markets";
  return PAGE_TOPIC[pathname] ?? "start";
}

export function supportTopicsFor(question: string, pathname = "/"): SupportTopic[] {
  const query = question.toLowerCase();
  const tokens = new Set(query.match(/[a-z0-9]+/g) ?? []);
  const ranked = SUPPORT_TOPICS.map(topic => {
    let score = 0;
    for (const keyword of topic.keywords) {
      const word = keyword.toLowerCase();
      if (word.includes(" ")) { if (query.includes(word)) score += 6; }
      else if (tokens.has(word)) score += 3;
    }
    if (score && topic.id === pageTopic(pathname)) score += 1;
    return { topic, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (ranked.length) return ranked.slice(0, 2).map(item => item.topic);
  return question.trim() ? [] : [SUPPORT_TOPICS.find(topic => topic.id === pageTopic(pathname)) ?? SUPPORT_TOPICS[0]];
}

export function supportFallback(topics: SupportTopic[]): { answer: string; links: SupportLink[]; source: "knowledge" } {
  if (!topics.length) return {
    answer: "I can guide you through Tidelight’s research, markets, Agent Flow, community, account settings, and Bitget demo or live controls. Tell me what you are trying to do, and I’ll show you the right page and steps. Please keep passwords, API keys, and verification codes out of chat.",
    links: [{ label: "Start here", href: "/guide" }], source: "knowledge",
  };
  return { answer: topics[0].answer, links: topics[0].links, source: "knowledge" };
}

export function allowedSupportLinks(topics: SupportTopic[], ids: unknown): SupportLink[] {
  if (!Array.isArray(ids)) return topics[0]?.links ?? [];
  const approved = new Set(topics.flatMap(topic => topic.links.map(link => link.href)));
  return ids.filter((id): id is string => typeof id === "string" && approved.has(id)).slice(0, 3)
    .map(href => topics.flatMap(topic => topic.links).find(link => link.href === href)!)
    .filter((link, index, all) => all.findIndex(item => item.href === link.href) === index);
}
