// btc-cent-forecast-01: guess BTC's price 240 minutes after a checkpoint.
//
// The idea is deliberately boring. Bitcoin's 4-hour move is dominated by
// whatever it did in the last hour, so the forecast is: take the last
// close, add the move of the last 60 minutes, and cap that move at
// +/-$500 so a single pool spike cannot drag the guess away.
//
//   forecast = last + clamp(last - price[60 minutes ago], -500, +500)
//
// Why this and nothing fancier: on the five exactly-scorable practice
// cases this scores 31,044 cents mean absolute error against 47,055 for
// simply repeating the last close. The fancier candidates (median anchors,
// mean reversion, 4h/12h drift, regression slopes) all lost to the
// baseline when tested leave-one-out, so they were dropped. The practice
// window was a steady downtrend, which flatters momentum, so the honest
// expectation for the final is a 5-15% edge, not 34%.
//
// The program is pure stdlib, reads every <id>.in it finds in the input
// directory, and writes one <id>.out per case. It never touches the
// network and its output depends only on the input file, so running it
// twice gives byte-identical results.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// How far back the momentum is measured, in minutes (one price a minute).
const LOOKBACK_MINUTES = 60;
// The largest 60-minute move we let through, in dollars. Median |60-min
// move| in the practice window is $156, p90 $479, max $2,107 — the cap is
// insurance against pool spikes, not a fitted number.
const MOVE_CAP_DOLLARS = 500;
// The scorer only accepts 0 < price < 10,000,000; keep the guess inside
// with a little room on both ends.
const PRICE_MIN = 0.00001;
const PRICE_MAX = 9_999_999.99999;

type CaseFile = {
  case: string;
  markets: Array<{ prices: number[] }>;
};

function lastUsablePrice(prices: number[]): number | null {
  for (let i = prices.length - 1; i >= 0; i--) {
    const p = prices[i];
    if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
  }
  return null;
}

function forecastPrice(prices: number[]): number {
  const last = lastUsablePrice(prices);
  if (last === null) {
    throw new Error("no usable price in this case");
  }
  // The whole series has to be clean before momentum is trusted: one
  // corrupt tick anywhere means the drift is untrustworthy, so fall back
  // to repeating the last close. That is the score an invalid case would
  // get anyway — but the case stays valid, and an entry with any invalid
  // case takes no prize at all, so falling back is strictly better than
  // crashing or guessing from poisoned data.
  const clean =
    prices.length > LOOKBACK_MINUTES &&
    prices.every((p) => typeof p === "number" && Number.isFinite(p) && p > 0);
  if (!clean) return last;
  const hourAgo = prices[prices.length - 1 - LOOKBACK_MINUTES];
  let move = last - hourAgo;
  if (move > MOVE_CAP_DOLLARS) move = MOVE_CAP_DOLLARS;
  if (move < -MOVE_CAP_DOLLARS) move = -MOVE_CAP_DOLLARS;
  const guess = last + move;
  if (guess <= PRICE_MIN) return PRICE_MIN;
  if (guess >= PRICE_MAX) return PRICE_MAX;
  return guess;
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = readdirSync(INPUT_DIR)
    .filter((name) => name.endsWith(".in"))
    .sort();
  if (files.length === 0) {
    throw new Error(`no .in files in ${INPUT_DIR}`);
  }
  for (const file of files) {
    const raw = readFileSync(join(INPUT_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as CaseFile;
    // The case id normally comes from the file itself; if it is missing,
    // fall back to the input filename stem instead of aborting the whole
    // run — one malformed file should not cost every other case its output.
    const caseId =
      typeof parsed.case === "string" && parsed.case.length > 0
        ? parsed.case
        : file.slice(0, -".in".length);
    const prices = parsed.markets?.[0]?.prices;
    if (!Array.isArray(prices)) {
      throw new Error(`${file}: missing markets[0].prices`);
    }
    const price = forecastPrice(prices);
    const out = { forecasts: [{ case: caseId, price }] };
    writeFileSync(join(OUTPUT_DIR, `${caseId}.out`), JSON.stringify(out) + "\n");
  }
}

main();
