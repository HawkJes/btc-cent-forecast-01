# btc-cent-forecast-01

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![rank](https://make.fun/badge/btc-cent-forecast-01/HawkJes/btc-cent-forecast-01/rank.svg)](https://make.fun/bounty/btc-cent-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

Forecast Bitcoin's price 4 hours ahead from 72 hours of 1-minute closes.

## Model

Short-horizon momentum, shrunk and clamped:

```
forecast = last + clamp(1.0 * (last - price 60 minutes ago), -500, +500)
```

The last hour's move repeats for one more hour's worth, then stops. The
±$500 cap binds only on pool spikes (the Orca cbBTC/USDC pool's price can jump
on a single large trade; the largest 60-minute move in the practice window was
$2,107, while the median was $156).

## Evidence (practice, 5 scored cases p00–p04)

| model | MAE (cents) |
|---|---|
| persistence (house baseline) | 47,055 |
| this model | 31,044 |

Practice answers for p00–p04 are exact (each case's target is the next case's
last price; overlaps verified 4080/4080). p05's target is outside the kit.
Leave-one-out on the conservative model family: ~42,600 vs 47,055 persistence.
Median-anchor, mean-reversion, long-horizon drift and regression-slope drift
all failed leave-one-out and were rejected. The practice window was a steady
downtrend, which flatters momentum — the honest expected edge on the unseen
final is 5–15%, not the 34% in-sample figure.

## Run

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads every `<id>.in` in the input directory, writes `<id>.out` with exactly
one forecast row. Standard library only, no network, deterministic.

## License

MIT — see LICENSE.
