# Popular Trading Models — Pine Script v6 Recreations

The "trading model" scene (ICT/Smart Money and its offshoots) is built on a shared
vocabulary: **liquidity sweeps** (stop raids past old highs/lows), **CISD** (Change In
State of Delivery — a close through the open of the candle series that made an extreme),
**FVGs** (fair value gaps), **displacement**, and **killzone timing**. Each model is a
different recipe over those ingredients. These are educational recreations of the six
most popular ones, with credit to their originators.

| File | Model | The recipe |
|------|-------|-----------|
| `candle_range_theory.pine` | **CRT — Candle Range Theory** | An HTF candle purges the previous candle's high/low but closes back inside its range → delivery targets the opposite side. Tracks the active range, marks delivery ✓ or invalidation ✗. |
| `ttrades_fractal_model.pine` | **TTFM — TTrades Fractal Model** (credit @TTrades) | Three HTF candles: C1 sets the range, C2 sweeps C1's extreme and closes back inside (reversal closure), C3 is traded — entry on lower-timeframe CISD, targeting C1's opposite side. |
| `forever_model.pine` | **Forever Model** (credit @toodegrees) | "No sweep, no trade": HTF liquidity sweep with rejection → optional SMT divergence vs a correlated symbol → LTF CISD confirms → entry at CISD/confirmation-leg FVG, targeting opposing liquidity. |
| `ict_2022_model.pine` | **ICT 2022 Model** (credit ICT) | The most famous ICT entry: liquidity sweep of an old swing → Market Structure Shift with displacement (body > ATR multiple) → entry on the retrace into the displacement FVG. Optional NY killzone filter. |
| `silver_bullet.pine` | **ICT Silver Bullet** (credit ICT) | Pure time-based: during 03:00-04:00, 10:00-11:00, or 14:00-15:00 NY, trade the first FVG in the bias direction (daily open or EMA filter). Boxes drawn per window, entries on the retrace. |
| `power_of_three.pine` | **ICT Power of Three (AMD)** (credit ICT) | The daily narrative: Asia accumulates around the midnight NY open, London manipulates one side of the Asia range (Judas swing), New York distributes the other way. Signals on the reclaim/loss of midnight open after the Judas swing. |

## How to use

1. Paste a `.pine` file into TradingView's Pine Editor → **Save** → **Add to chart**.
2. These are intraday models — CRT/TTFM/Forever work on any chart TF below their HTF
   input (e.g. 5m chart + 1H/4H model timeframe); Silver Bullet and Po3 need an
   intraday chart (1m-15m is typical).
3. Session/killzone times are set in **New York time** and configurable.
4. Every stage of every model ships an `alertcondition` — you can alert on the setup
   forming (sweep, C2 closure, Judas swing) or only on the confirmed entry.

## Honest caveats

- These models were designed for discretionary trading; mechanical recreations
  necessarily simplify (e.g. TTFM's "point of interest" quality check and the Forever
  Model's draw-on-liquidity narrative are left to your eyes).
- HTF data uses the confirmed-candle pattern (`[1]`/`[2]` offsets with lookahead) so
  signals don't repaint after the fact.
- None of this is financial advice; sweep-based models look spectacular in hindsight
  precisely because sweeps happen constantly — forward-test before trusting.
