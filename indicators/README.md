# Popular Claude-Built TradingView Indicators

TradingView doesn't label community scripts by which AI helped write them, so there is no
official "top Claude indicators" chart. But across tutorials, community posts, and AI trading
tool roundups, the same handful of indicator types come up again and again as the things
traders most often build with Claude. This folder recreates the four most popular ones in
**Pine Script v6**.

## The indicators

| File | Indicator | Why it's popular |
|------|-----------|------------------|
| `ema_crossover_rsi_filter.pine` | **EMA Crossover + RSI Filter** | The classic first build: fast/slow EMA cross signals, filtered by RSI so you skip overbought longs and oversold shorts. Shows filtered-out signals too, plus alerts. |
| `multi_timeframe_dashboard.pine` | **Multi-Timeframe Trend Dashboard** | A corner table showing trend, RSI, and MACD across five timeframes with a confluence score — the most-requested "give me everything at a glance" build. |
| `rsi_divergence_detector.pine` | **RSI Divergence Detector** | Auto-detects regular and hidden bullish/bearish divergences between price and RSI using pivot points. Divergence logic is fiddly to write by hand, so it's a top ask. |
| `key_intraday_levels.pine` | **Key Intraday Levels** | Previous day high/low/close, today's open, opening range, and session VWAP in one overlay — the "all my key levels in one place" build that went viral as a Claude use case. |

## How to use

1. Open any chart on [TradingView](https://www.tradingview.com) and open the **Pine Editor** (bottom panel).
2. Paste the contents of one `.pine` file, click **Save**, then **Add to chart**.
3. Adjust inputs from the indicator's ⚙ settings — every parameter is exposed as an input.

Notes:

- All scripts are Pine Script **v6** and use `lookahead_off` / bar-shifted daily data where it
  matters, so signals don't repaint historical bars (divergences confirm `lbR` bars after the
  pivot by design).
- **Key Intraday Levels** only draws on intraday timeframes; set the opening-range session to
  your market's hours (default `0930-1000`, exchange timezone).
- Each script ships `alertcondition`s, so you can wire any signal to a TradingView alert.

*Educational tools, not financial advice — test on paper before trading real money.*
