// btc-cent-forecast-01 entry: short-horizon momentum, shrunk and clamped.
//   forecast = last + clamp(1.0 * (last - price 60 min ago), -500, +500)
// i.e. the last hour's move repeats for one more hour's worth, then stops.
// The +/-$500 cap binds only on pool spikes (max 60-min move in the practice
// window was $2,107; median |60-min move| $156, p90 $479) — it is insurance,
// not a fitted parameter.
//
// Evidence (~/workspace/makefun/btc-cent-analysis/analyze.py, 5 scored
// practice cases p00..p04; p05's target, 2026-11-11T06:00Z, is outside the kit
// so it cannot be scored locally):
//   persistence (house baseline): 47,055 cents MAE on p00..p04
//     (stated 6-case practice baseline: 44,522 cents)
//   this model (g=1.0, cap 500):   31,044 cents MAE (-34% in-sample)
//   leave-one-out, conservative family (fit k on 4 cases, test 1):
//     ~42,600 vs 47,055 persistence — k stable at 0.2-0.4 across folds.
//   g=1.0 is the centre of the g in [0.8, 1.5] plateau (27k-32k in-sample).
//   Honest expectation for the final (12 unseen cases): a 5-15% edge over
//   persistence, not 34% — the practice window (7-11 Nov) was a steady
//   downtrend, which flatters momentum. The prize gate is strictly below the
//   baseline's final score; 1st place ($40) is mostly luck across 12 cases.
//   Median-anchor, mean-reversion and long-horizon drift (H240/H720) all
//   FAILED leave-one-out (worse than persistence) and were rejected.
//   Slope (regression) drift also lost to endpoint drift. Do not "improve"
//   this model by refitting on the 5 cases — that is overfitting.
//
// Reads every <id>.in in the input directory (the grader runs one case at a
// time, with only that case's file there) and writes <id>.out with exactly
// one forecast row. Standard library only, no network, deterministic.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** Minutes of recent price history the momentum signal reads. */
const MOMENTUM_MINUTES = 60;
/** Gain on the last-hour move: 1.0 = the move repeats once more. */
const MOMENTUM_GAIN = 1.0;
/** Cap on the drift in dollars: binds only on pool spikes, never typical moves. */
const DRIFT_CAP_USD = 500;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/**
 * Forecast for one market: last close plus the last hour's move, shrunk by
 * MOMENTUM_GAIN and clamped to +/-DRIFT_CAP_USD. Falls back to the first
 * price as the anchor if a case ever holds 60 or fewer closes.
 */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  // A single non-finite price anywhere in the window would silently poison
  // the anchor or the last close, so reject the whole case up front instead
  // of forecasting from a corrupted series.
  for (let i = 0; i < m.prices.length; i++) {
    if (typeof m.prices[i] !== 'number' || !Number.isFinite(m.prices[i] as number)) throw new Error(`market ${m.id} has a non-finite price at index ${i}`);
  }
  const last = m.prices[m.prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  const anchorIndex = m.prices.length > MOMENTUM_MINUTES ? m.prices.length - 1 - MOMENTUM_MINUTES : 0;
  const anchor = m.prices[anchorIndex] as number;
  if (typeof anchor !== 'number' || !Number.isFinite(anchor)) throw new Error(`market ${m.id}'s anchor price is not a finite number`);
  const drift = Math.max(-DRIFT_CAP_USD, Math.min(DRIFT_CAP_USD, MOMENTUM_GAIN * (last - anchor)));
  return price5(last + drift);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
