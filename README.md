# btc-cent-forecast-01

Forecast Bitcoin's price 240 minutes after a checkpoint, from the 72 hours
of 1-minute closes that lead up to it.

## The model

Capped one-hour momentum:

```
forecast = last + clamp(last - price 60 minutes ago, -$500, +$500)
```

Take the last close, add the move of the last 60 minutes, and cap that
move at ±$500. The cap only binds on pool spikes (median |60-min move| in
the practice window is $156, p90 $479, max $2,107), so it is insurance,
not a fitted parameter.

## Why this model

Scored on the five exactly-scorable practice cases (p00–p04; each case's
target is the next case's last close, so the answers are recoverable
exactly — p05's target sits outside the kit and cannot be scored locally):

| model | mean absolute error (cents) |
| --- | --- |
| repeat the last close (house baseline) | 47,055 |
| capped 1h momentum, gain 1.0, cap ±$500 | **31,044** (−34% in-sample) |

Leave-one-out on the conservative family: ~42,600 vs 47,055 for the
baseline, with the fitted gain stable at 0.2–0.4 across folds. The
alternatives were all tried and dropped: median anchors, mean reversion
to the median, 4h/12h drift, regression-slope drift, and median+drift
combos — every one of them lost to the baseline leave-one-out.

Honest expectation for the final (12 unseen cases): a **5–15% edge** over
the baseline, not 34%. The practice window (7–11 Nov) was a steady
downtrend, which flatters momentum, and with 12 cases luck dominates the
top places. The prize gate is a score strictly below the baseline's final
score, with every case valid — this model is the low-variance choice for
clearing it (worst per-case degradation vs the baseline is +32%, while
the wins are large).

## How it runs

Node 22, standard library only, no network, deterministic:

```sh
MAKEFUN_INPUT_DIR=<dir with <id>.in files> \
MAKEFUN_OUTPUT_DIR=<dir for <id>.out files> \
node main.ts
```

It reads every `*.in` file in the input directory (in name order) and
writes one `<id>.out` per case, each `{"forecasts": [{"case": "<id>",
"price": <guess>}]}`. If a case's price series contains a corrupt tick,
the momentum is not trusted and the forecast falls back to the last
close — the case stays valid instead of crashing (an entry with any
invalid case takes no prize).

## Files

- `main.ts` — the entry (see the header comment for the full reasoning)
- `README.md` — this file
- `LICENSE` — MIT
- `package.json` — `{"type": "module"}`
- `.makefun/owner.json` — the account's primary wallet
