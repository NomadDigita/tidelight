# Strategy Lab · live data validation

**Captured:** 2026-10-05  
**Market source:** Bitget public Spot candles  
**Interval:** 4 hours  
**Method:** SMA 20/50, 66/34 chronological split, 0.10% fee plus 0.05% slippage per side, $10,000 simulated starting equity. The in-progress candle was excluded before scoring and hashing.

This is a single trailing-window diagnostic, not evidence of a durable strategy edge. The holdout is the final 30.3–30.5 days of the captured history. Simulated strategy returns include the configured fees and slippage; the buy-and-hold comparator includes the same entry and exit costs. Results exclude dividends, issuer actions, financing, order-book liquidity, and token-specific execution differences.

## Holdout results

| Bitget pair | Instrument | Candles evaluated | Training after warm-up | Holdout | Strategy return | Buy and hold | Max drawdown | Closed trades |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `RAAPLUSDT` | Apple Reality | 535 | 50.7 days | 30.3 days | −1.09% | +3.74% | 3.73% | 2 |
| `RNVDAUSDT` | NVIDIA Reality | 539 | 50.7 days | 30.5 days | −1.42% | +2.14% | 5.73% | 3 |
| `RTSLAUSDT` | Tesla Reality | 539 | 50.7 days | 30.5 days | −2.83% | +3.90% | 4.60% | 4 |
| `BTCUSDT` | Bitcoin | 539 | 50.7 days | 30.5 days | −0.71% | +7.91% | 6.78% | 3 |
| `ETHUSDT` | Ethereum | 539 | 50.7 days | 30.5 days | −4.59% | +10.36% | 9.38% | 4 |

All five tested holds underperformed the same-window buy-and-hold comparator. Tidelight therefore presents this baseline as an inspectable experiment, not an alpha claim.

## Data window and fingerprints

All evaluated histories cover `2026-07-07T16:00:00Z` through `2026-10-05T08:00:00Z`. The SHA-256 value fingerprints the ordered JSON array of completed candles passed to the strategy runner; it is included to identify this exact input snapshot.

| Pair | SHA-256 of completed candle JSON |
|---|---|
| `RAAPLUSDT` | `edd72df7e7b7800b49b7b5297db30bdb9b3e0f7c7a7da961a17e205354fcfe15` |
| `RNVDAUSDT` | `cfca0be0ad25e56f796ef666316dd7148d5e277c3160d029f223d884d8b0fe63` |
| `RTSLAUSDT` | `e57c8c3180002f0bd757abe08ff0fa4fdfc5755eaac8a178dd58d814eed4cb67` |
| `BTCUSDT` | `726d826065dfb1f5805a7ccdc62f64a7130a79166c62fb9e21615b91191debc6` |
| `ETHUSDT` | `fabc3f0dad681095f46111dba7615256efafd01cebd80a12a88aa7249b5f7000` |

The live Strategy Lab saves each signed-in user's full candle array, parameters, metrics, and fingerprint in private Supabase history. The probe above was a read-only validation run; it did not create a user's saved run.
