# TheStrat All-In-One Indicator

A single TradingView Pine Script (v5) indicator that packs the full #TheStrat toolkit into one overlay: [`TheStrat_All_In_One.pine`](TheStrat_All_In_One.pine).

## Features

- **Candle numbering & coloring** — every bar is classified and labeled as `1` (inside), `2U` (two-up), `2D` (two-down), or `3` (outside), with configurable bar colors.
- **Actionable combo signals** — reversal labels printed on the trigger bar:
  - `2-2` reversals (2D→2U and 2U→2D)
  - `X-1-2` family (2-1-2, 3-1-2, 1-1-2, and X-1-3 outside triggers)
  - `3-2-2` reversals
  - `1-2-2` RevStrat
  - `2-3` outside-bar engulf reversals
  - Optional `2-2` continuation triangles
- **Full Timeframe Continuity (FTFC) table** — live open-vs-price direction for 15m, 1H, 4H, D, W, M, Q, Y (each toggleable), with an overall `FTFC BULL / BEAR / Mixed` summary and the current 3-bar combo string. Timeframes below the chart timeframe can be auto-hidden.
- **Multi-timeframe strat candles** — the table's `Strat` row shows what candle type (1 / 2U / 2D / 3) each higher timeframe is currently printing.
- **Pivot Machine Gun (PMG)** — flags when a configurable-length string of higher lows (or lower highs) gets snapped.
- **Hammers & shooters** — marked with `H` / `S` characters.
- **Inside-bar trigger lines** — dashed lines drawn from each inside bar's high and low, extended until price breaks them (capped number of active setups).
- **12 built-in alerts** — bullish/bearish reversals, continuations, inside bar, outside bar, hammer, shooter, PMG bull/bear, and FTFC flipping bullish or bearish.

## Installation

1. Open TradingView and go to **Pine Editor** (bottom panel).
2. Copy the entire contents of `TheStrat_All_In_One.pine` and paste it into the editor.
3. Click **Add to chart**.
4. Configure toggles, colors, and timeframes in the indicator settings.

## Alerts

Create an alert on the chart, pick **TheStrat All-In-One** as the condition, and choose any of the built-in alert conditions (e.g. *Strat: Bullish reversal*, *Strat: FTFC turned bullish*). Signals fire on confirmed bar close.

## Notes

- The FTFC row compares each timeframe's **current developing candle** close against its open — by design this updates live intrabar.
- Signal labels and trigger lines are only drawn on confirmed (closed) bars, so they do not repaint.
