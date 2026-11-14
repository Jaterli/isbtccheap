import type { ReactNode } from "react";
import type { Messages } from "./es";

/** "A", "A and B", "A, B and C" */
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));

export const en: Messages = {
  loading: "Loading…",
  noData: "No data",
  dataError: "Could not load the daily data. Run the pipeline (python pipeline/build.py).",
  infoAbout: (label: string) => `About ${label}`,
  percent: (n: string) => `${n}%`,
  language: "Language",
  nav: { aria: "Sections", index: "Index", volatility: "Volatility", cycles: "Cycles", valuation: "Valuation", drawdown: "Drawdown", categories: "Categories", liquidity: "Liquidity", sentiment: "Sentiment", technical: "Technical", metrics: "Metrics", analysis: "Analysis", legal: "Legal notice", privacy: "Privacy", cookies: "Cookies", top: "Back to top" },
  cycles: {
    scores: {
      card: "Cycle and price: the index score",
      info: [
        "Each line is a score from 0 (cheap) to 100 (expensive), the same one the index uses, overlaid on the BTC price (right axis, log scale). “Cycle” is the category: the average of the **halving cycle phase**, the **power law deviation** and the **price vs the 200-week moving average**. Hovering the chart also shows the metric's actual value.",
        "**The halving phase** is not compared with the past: it scores according to how much of the cycle has elapsed (cheap after the bottom, expensive towards the typical top, about 12-18 months after the halving), and its actual value is that share of the cycle. The **power law** and the **200-week average** are compared with their previous 4 years.",
      ],
      category: "Cycle",
      short: { halving_phase: "Halving phase", power_law: "Power law", wma200_ratio: "200W MA" },
      metricAria: "Score overlaid on the price",
      cols: { metric: "Metric", value: "Current value", now: "Today", m1: "1 month ago", m3: "3 months ago" },
      note: "Historical data computed each day without looking ahead (each metric is only compared with its past), not a forecast or investment advice.",
      chartAria: "Chart of the Bitcoin price with the cycle score overlaid",
    },
    chartLink: "See how the cycle score has evolved",
    title: "Bitcoin cycles since each halving",
    rest: "The current cycle against those of 2012, 2016 and 2020: how much the price has risen since its halving, when the top came and how far it fell afterwards.",
    card: "Price since each halving",
    info: [
      "Each line is a cycle: Bitcoin's price divided by its price on the halving day, against the days elapsed since then. ×1 is the halving price; ×2, double. The scale is logarithmic so that cycles with very different rallies can be compared.",
      "The dot on each line marks the cycle top, searched for in the first two years after the halving. Tap the years to show or hide each cycle. It uses the daily price history since 2011 plus the current price.",
    ],
    toggleAria: "Cycles shown",
    current: (day: ReactNode, phase: ReactNode, mult: ReactNode, others: string) => (
      <>
        Today is day {day} of the current cycle ({phase} of the way to the next halving) and BTC trades at {mult} the halving
        price. At this point, previous cycles were at {others}.
      </>
    ),
    sincePeak: (date: ReactNode, day: number, fall: ReactNode) => (
      <>
        This cycle's high came on {date} (day {day}) and the price is now {fall} below it.
      </>
    ),
    dayN: (d: number) => `Day ${d} after the halving`,
    yearN: (y: number) => (y === 0 ? "Halving" : y === 1 ? "1 year" : `${y} years`),
    today: "Today",
    peakTitle: (year: number, day: number, mult: string) => `${year} cycle top: day ${day}, ${mult}`,
    cols: {
      cycle: "Cycle",
      halvingPrice: "Halving price",
      peak: "Top",
      peakDay: "Top day",
      peakMult: "× at top",
      drawdown: "Drop after top",
      atToday: (d: number) => `Day ${d}`,
    },
    note: "* Cycle in progress: largest drop so far. Historical data, not a forecast or investment advice.",
    chartAria: "Chart of Bitcoin's price in each cycle, as a multiple of the price on the halving day",
  },
  valuation: {
    scores: {
      card: "On-chain valuation and price: the index score",
      info: [
        "Each line is a score from 0 (cheap) to 100 (expensive), the same one the index uses, overlaid on the BTC price (right axis, log scale). “Valuation” is the category: the average of **MVRV**, the **Puell Multiple** and the **Mayer Multiple**. Hovering the chart also shows the metric's actual value.",
        "Each metric is compared with its previous 4 years (one halving cycle): a high score means it is more expensive than almost always in that period. It is the category that weighs most in the index from the daily timeframe up, and the one that has best marked cycle tops and bottoms in the backtest.",
      ],
      category: "Valuation",
      short: { mvrv: "MVRV", puell: "Puell", mayer: "Mayer" },
      metricAria: "Score overlaid on the price",
      cols: { metric: "Metric", value: "Current value", now: "Today", m1: "1 month ago", m3: "3 months ago" },
      note: "Historical data computed each day without looking ahead (each metric is only compared with its past), not a forecast or investment advice.",
      chartAria: "Chart of the Bitcoin price with the on-chain valuation score overlaid",
    },
    chartLink: "See how on-chain valuation has evolved",
    title: "Bitcoin valuation bands",
    rest: "BTC's price against its long-term levels: realized price, 200-week moving average and the power law trend.",
    card: "Price and valuation levels",
    info: [
      "**Realized price**: the average price at which the bitcoins in circulation last moved, an approximation of what their owners paid on average (price / MVRV, from Coin Metrics). **Short-term holder realized price**: the same for coins younger than 150 days only, the average cost of recent buyers (from Bitview). **200-week moving average**: the average price over the last four years, roughly one cycle.",
      "**Power law**: the straight line that best fits the price on a logarithmic scale against the days since the genesis block. The shaded corridor contains 95% of days since 2013. The scale is logarithmic and the last day uses the current price.",
    ],
    current: (price: ReactNode, vsRealized: ReactNode, vsWma: ReactNode, vsTrend: ReactNode, zone: string) => (
      <>
        Current price: {price}, {vsRealized} versus the realized price and {vsWma} versus the 200-week moving average. Relative to
        the power law trend it is at {vsTrend}, {zone}.
      </>
    ),
    zones: {
      below: "below its usual corridor",
      nearLow: "near the floor of its usual corridor",
      underTrend: "below the trend",
      overTrend: "above the trend",
      nearHigh: "near the ceiling of its usual corridor",
      above: "above its usual corridor",
    },
    legend: { price: "Price", realized: "Realized", sth: "STH realized", wma: "200W MA", trend: "Power law" } as Record<string, string>,
    levels: {
      realized: "Realized price",
      sth: "Short-term holder realized price",
      wma: "200-week moving average",
      trend: "Power law trend",
      low: "Corridor floor",
      high: "Corridor ceiling",
    },
    cols: { level: "Level", value: "Today", distance: "Price vs level" },
    note: "Historical data, not a forecast or investment advice. The power law fit is recalculated daily using the full history.",
    chartAria: "Chart of Bitcoin's price with the total and short-term holder realized price, the 200-week moving average and the power law",
  },
  status: { candle: (tf: string) => `${tf} candle` },
  priceToggle: { show: "Show price", hide: "Hide price" },
  priceCard: {
    title: "BTC price",
    resize: "Price chart height",
    tfs: {
      "15m": { label: "15 minutes", short: "15m" },
      "1h": { label: "1 hour", short: "1h" },
      "4h": { label: "4 hours", short: "4h" },
      "1d": { label: "1 day", short: "1D" },
    },
    chartAria: "Bitcoin price chart in the selected timeframe",
  },
  movesLink: { text: "How long has BTC gone without a 10% drop or a 20% rally? Compare it with what is usual.", cta: "Drops and rallies" },
  drawdown: {
    title: "Bitcoin drops and rallies",
    rest: "How far BTC is below its all-time high, how that compares with previous major drops and how long it has gone without a 5%, 10% or larger drop or rally.",
    card: "Price and drawdown from the all-time high",
    info: [
      "The drawdown is the distance between each day's price and the all-time high reached up to then: 0% at highs, -50% if the price is worth half.",
      "It uses the daily price since 2010 plus the current price. The table lists the drops of more than 50% since 2011 (before that the market was tiny) and the current one.",
    ],
    current: (dd: ReactNode, ath: ReactNode, athDate: ReactNode, days: ReactNode, maxDd: ReactNode, lowDate: ReactNode) => (
      <>
        BTC is {dd} below its all-time high ({ath}, on {athDate}), reached {days} days ago. The largest drop since then has been{" "}
        {maxDd} ({lowDate}).
      </>
    ),
    atAth: (ath: ReactNode) => <>BTC is at an all-time high: {ath}.</>,
    bears: (n: number, min: ReactNode, max: ReactNode) => (
      <>
        In the {n} previous major bear markets, the drop ranged from {min} to {max}.
      </>
    ),
    legend: { price: "Price", ath: "High", dd: "Drawdown" },
    tableTitle: "Major drops from the high",
    cols: { ath: "High", low: "Low", dd: "Drop", toLow: "Days to low", toRecover: "Days to recover" },
    ongoing: "Ongoing",
    note: "Historical data, not a forecast or investment advice.",
    chartAria: "Chart of Bitcoin's price with its all-time high and of the drawdown from that high",
  },
  catHistory: {
    title: "Index history by category",
    rest: "How the index's five categories have evolved since 2011 and what they showed at each cycle top and bottom.",
    card: "Score and categories over time",
    info: [
      "Each row is the daily score (daily close) of a category, from 0 (cheap, green) to 100 (expensive, red), with the same color bands as the gauge. The first row is the 1-day score, which combines them with their weights. With long periods, each column is the average of several days.",
      "The vertical lines mark cycle tops (red) and the bottoms that followed them (green). Sentiment uses short-term SOPR since 2011, and adds the Fear & Greed Index from 2018 and spot ETF flows from 2025.",
    ],
    current: (day: ReactNode, score: ReactNode, cheapest: string, cheapV: ReactNode, dearest: string, dearV: ReactNode) => (
      <>
        At the {day} close the 1-day score is {score}. The cheapest category is {cheapest} {cheapV} and the most expensive,{" "}
        {dearest} {dearV}.
      </>
    ),
    short: {
      score: "Score",
      valoracion: "Valuation",
      ciclo: "Cycle",
      liquidez: "Liquidity",
      sentimiento: "Sentiment",
      tecnico: "Technical",
    },
    priceLegend: "Price",
    tableTitle: "At cycle tops and bottoms",
    cols: { when: "When", price: "Price" },
    kinds: { today: "Today", top: "Top", bottom: "Bottom", lowSoFar: "Current low" },
    note: "Historical data computed each day without looking ahead (each metric is only compared with its past), not a forecast or investment advice.",
    chartAria: "Chart of Bitcoin's price and heatmap of the score and its five categories since 2011",
  },
  sentiment: {
    title: "Bitcoin market sentiment",
    rest: "The score of sentiment and each of its metrics against the BTC price, in 1h, 4h and 1 day: how the part of the index that weighs most in short timeframes moves.",
    card: "Sentiment and price",
    info: [
      "Each line is a score from 0 (fear: cheap) to 100 (euphoria: expensive), the same one the index uses, overlaid on the BTC price (right axis, log scale). “Sentiment” is the category: the average of its metrics in that timeframe. Hovering the chart also shows the metric's actual value.",
      "The index uses the same daily metrics in every timeframe: the **Fear & Greed Index**, **short-term SOPR** and **ETF flows** (scored against their last 4 years). In 1h and 4h, each candle shows its day's value.",
      "Informational (not used by the index): **Binance derivatives** (**open interest**, **accounts long** and **market buys**, scored against their last 30 days, which is all Binance keeps) stopped counting in 1h and 4h because there is no history to test whether they lead the price, and with a month of data accounts long pointed the opposite way to how the index scored them. They are being stored for a backtest. Their first candles have no score until 50 data points are available.",
      "**Spot buys** (informational, not used by the index): the share of BTC/USDT spot volume on Binance that was market buying, over the last 3 candles; 50% is balance. Binance keeps its whole history (since 2017): in 1D it is scored against its previous 4 years and in 1h and 4h against what is downloaded. It helps compare spot with futures: if spot buys while futures sell, someone is absorbing the leveraged selling. Market buys and spot buys change a lot from one candle to the next: the latest ones are shown (5 days in 1h, 10 in 4h and 1 or 3 months in 1D) so they read better.",
      "**Short-term supply in loss** (informational): the share of short-term holders' coins (moved less than 155 days ago) worth less than when bought, from Bitview. It is scored the other way round from the rest: many losses is fear, a low score. It marks cycle tops and bottoms better than the Fear & Greed Index, but in the index backtest it led slightly worse and measures almost the same, so it does not replace Fear & Greed.",
      "**Realized loss** (informational): what coins moving below the price they were bought at lose each day, across all holders (Bitview), against its 90-day average: ×3 is three times the usual. It is scored the other way round from the rest, against its previous 4 years: heavy losses are fear, a low score. In the backtest it did not lead the price in general; after spikes of 5 times its average, the following month was somewhat better than average.",
      "**Adjusted short-term MVRV** (informational): the price against the average cost of short-term holders (Bitview realized price), compared with its 90-day average. It is scored by deviations from its last year: 25 and 75 are the −1σ and +1σ bands, and 0 and 100, the −2σ and +2σ ones. In the backtest it followed the price rather than leading it; well below its lower band (−1.5σ or less) a 1-2 week bounce usually came, which had faded 30 days later most of the time.",
    ],
    current: (tf: string, cat: ReactNode, metrics: string) => (
      <>
        In the {tf} timeframe, the sentiment category currently stands at {cat}. It is made up of {metrics}.
      </>
    ),
    short: {
      sentimiento: "Sentiment",
      fear_greed: "Fear & Greed",
      sth_sopr: "STH SOPR",
      etf_flows: "ETF 20 ses.",
      open_interest: "Open interest",
      long_pct: "Accounts long",
      taker_pct: "Market buys",
      spot_buy_pct: "Spot buys",
      sth_loss_pct: "STH in loss",
      realized_loss_ratio: "Realized loss",
      sth_mvrv_adj: "Adj. STH MVRV",
    },
    names: {
      sentimiento: "Sentiment category (1h)",
      fear_greed: "Fear & Greed Index",
      sth_sopr: "Short-term SOPR (7 days)",
      etf_flows: "ETF flows (20 sessions)",
      open_interest: "Open interest",
      long_pct: "Accounts long",
      taker_pct: "Market buys",
      spot_buy_pct: "Spot buys (informational)",
      sth_loss_pct: "Short-term supply in loss (informational)",
      realized_loss_ratio: "Realized loss vs its 90-day average (informational)",
      sth_mvrv_adj: "Adjusted short-term MVRV (informational)",
    },
    btc: (v: string) => `${v} BTC`,
    sigma: (z: number) => `${z > 0 ? "+" : z < 0 ? "−" : ""}${Math.abs(z).toLocaleString("en-US", { maximumFractionDigits: 1 })}σ`,
    tfAria: "Timeframe",
    metricAria: "Score overlaid on the price",
    noData: "No data: Binance is not responding.",
    infoMetric: "Informational: the index does not use it (yet)",
    infoGroup: "Informational: the index does not use them (yet)",
    tableTitle: "Score now and before, in 1h",
    scoreNote: "From 0 (fear: cheap) to 100 (euphoria: expensive), as in the 1h index. 4 hours and 1 day ago, in the 1h candle of then.",
    cols: { metric: "Metric", now: "Now", h4: "4h ago", d1: "1 day ago" },
    note: "Historical data computed without looking ahead, not a forecast or investment advice.",
    chartAria: "Chart of the Bitcoin price with the sentiment score overlaid",
    chartLink: "See how sentiment has evolved",
  },
  technical: {
    title: "Bitcoin technical analysis",
    rest: "The index's technical score and each of its metrics against the BTC price, in 1h, 4h, 1 day and 1 week: the part of the index recalculated live.",
    card: "Technical and price",
    info: [
      "Each line is a score from 0 (stretched to the downside: cheap) to 100 (stretched to the upside: expensive), the same one the index uses, overlaid on the BTC price (right axis, log scale). “Technical” is the category: the average of its three metrics. Hovering the chart also shows the metric's actual value.",
      "**RSI 14**: 30 or below scores 0 and 70 or above, 100. **Bollinger %B (20, 2)**: 0 is the lower band and 100 the upper one. **Price vs 200-candle average**: its percentile against the last 1000 candles (on the weekly, against the whole history since 2011).",
      "It is calculated with Binance candles for each timeframe, like the index's live technical score; on the weekly, completed with the daily history. Each candle only uses data up to it.",
      "**Momentum**: the label, with its arrow, appears next to RSI 14 (in green or red, like its value) with RSI at 80 or above (strong bullish momentum) or at 20 or below (bearish), on 1h, 4h and 1 day: in backtests, those moves tended to continue. It is informational: it does not count in the score.",
    ],
    current: (tf: string, cat: ReactNode) => <>On the {tf} timeframe, the technical score currently stands at {cat}.</>,
    short: { tecnico: "Technical", rsi_14: "RSI 14", bollinger: "Bollinger %B", ma200_ratio: "Price / MA200" },
    names: {
      tecnico: "Technical category",
      rsi_14: "RSI 14",
      bollinger: "Bollinger %B (20, 2)",
      ma200_ratio: "Price vs MA200 (percentile)",
    },
    smoothAria: "Smoothing (average of the last candles)",
    smoothNone: "No smoothing",
    // N candles in the timeframe: days on 1D, hours on 1h, hours or days on 4h, weeks on the weekly
    smoothLabel: (n: number, tf: string) =>
      tf === "1h" ? `${n}h` : tf === "4h" ? (n * 4 < 48 ? `${n * 4}h` : `${Math.round((n * 4) / 24)}d`) : tf === "1w" ? `${n}w` : `${n}d`,
    smoothed: (name: string, span: string) => `${name} (${span} average)`,
    tfAria: "Timeframe",
    metricAria: "Score overlaid on the price",
    noData: "No data: Binance is not responding.",
    tableTitle: (tf: string) => `Score now and before, on ${tf}`,
    scoreNote: "From 0 (cheap) to 100 (expensive), as in the index. “Current value” is the RSI, the %B or the distance to the 200-candle average on the last candle.",
    cols: { metric: "Metric", value: "Current value", now: "Now", c1: "Previous candle", c6: "6 candles ago" },
    note: "Historical data without looking ahead, not a forecast or investment advice.",
    chartAria: "Chart of the Bitcoin price with the technical score overlaid",
    chartLink: "See how the technical score has evolved",
  },
  analysis: {
    title: "Bitcoin analysis",
    rest: "BTC's situation today according to an AI analysis: support and resistance, market bias and what is most likely over the next hours and 1-2 days.",
    card: "Zones and outlook",
    info: [
      "An AI model receives raw market data (weekly, daily, 4h and 1h candles with indicators computed from them plus market structure —highs and lows, breaks, RSI divergences and Fibonacci levels— and unfilled liquidity gaps —RSI, Bollinger, distance to moving averages and volatility—, open interest, long and short positioning, Fear & Greed and ETF flows), along with the medium- and high-impact headlines of the last 48 hours and this week's economic calendar, and makes its own analysis, with no levels or conclusions from this site. With it, it determines the support (green) and resistance (red) zones, stronger when they are more solid, and the bias.",
      "The solid arrow is what it considers most likely: first over the next hours and, from there, over 1-2 days. The dashed one is the alternative scenario for the next hours, and the short line, the price that would invalidate the main one. The dashed lines mark resting liquidity (highs and lows the price has not yet taken out, where stops build up) and the grey bands, unfilled gaps; the script computes them, not the model. The orange lines are the Fibonacci levels the model takes a target or invalidation from: they are computed levels, not zones where the price has reacted. Candles are 4h (or daily with the 1D selector, about 6 months, to see which levels have been reclaimed or lost) and run up to the time of the analysis, as the model saw them: they do not change until the next one, which runs Monday to Friday at 10:00 and 17:00, on Saturdays at 12:00 and on Sundays at 18:00 (Madrid time).",
    ],
    bias: { alcista: "Bullish bias", bajista: "Bearish bias", neutral: "Neutral bias" },
    confidence: ["low confidence", "medium confidence", "high confidence"],
    strength: ["Weak", "Medium", "Strong"],
    updated: (when: string, price: string) => `Analysis from ${when}, with BTC at ${price}.`,
    unavailable: "The analysis is not available yet.",
    close: "Close",
    legendLiquidity: "– – resting liquidity · grey bands: unfilled imbalances",
    fibLabel: (ratio: string, tf: string, correction: boolean, price: string) =>
      `Fib ${(Number(ratio) * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}% ${tf === "1w" ? "weekly" : "daily"}${correction ? " (pullback)" : ""} · ${price}`,
    liquidityLabel: "Liquidity",
    equalHighs: "Equal highs",
    equalLows: "Equal lows",
    legendStyle: "Solid arrow: most likely · dashed: alternative",
    ahead: (h: number) => `Next ${h}h`,
    aheadShort: (h: number) => `${h}h`,
    daysShort: "1-2d",
    invalidation: "Invalidation",
    mostLikely: (h: number) => `Next ${h}h`,
    days: "1-2 days",
    alternative: (h: number) => `Alternative (${h}h)`,
    move: (d: "alcista" | "bajista" | "lateral", target: string) =>
      d === "alcista" ? `A rise toward ${target}.` : d === "bajista" ? `A drop toward ${target}.` : `Sideways around ${target}.`,
    invalidatedAt: (price: string) => `Invalidated if it reaches ${price}.`,
    trend: "Underlying trend:",
    nextHours: "Next hours:",
    nextDays: "1-2 days:",
    points: "Key points",
    levelsTitle: "Support and resistance",
    cols: { zone: "Zone", range: "Range", distance: "Distance", strength: "Strength" },
    note: (model: string) =>
      `Analysis, zones and scenarios generated with AI (${model}) with data from Binance, Alternative.me and TFTC; it may contain errors. It is a reading of the moment, not a prediction or investment advice.`,
    chartAria: "Bitcoin 4-hour candles with support and resistance zones and arrows toward the most likely move over the next hours and the alternative scenario",
  },
  liquidity: {
    title: "Global liquidity and Bitcoin",
    rest: "The change in major central bank liquidity, shifted 13 weeks forward, against the BTC price: does liquidity lead the price?",
    card: "BTC price and global liquidity 13 weeks earlier",
    info: [
      "**Global liquidity** = Fed net liquidity (balance sheet − Treasury account − reverse repos) + the ECB and Bank of Japan balance sheets, in dollars. Weekly FRED data up to the latest Fed release; the Bank of Japan's is monthly and its latest value is carried forward. The orange line is its 13-week change.",
      "The orange line is shifted 13 weeks forward: each date shows the liquidity change from 13 weeks earlier, next to that day's BTC price (blue). If liquidity leads the price, both lines rise and fall together. The shaded stretch is the next 13 weeks: what the liquidity already released anticipates.",
    ],
    money: (bn: number) => `$${(bn / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} trillion`,
    current: (day: ReactNode, net: ReactNode, roc: ReactNode, plotted: ReactNode) => (
      <>
        Global liquidity as of {day}: {net}, {roc} over 13 weeks. Because of the lead, the chart plots it on {plotted}.
      </>
    ),
    correlation: (c: ReactNode) => <>Over the period shown, its correlation with BTC's return over the following 13 weeks is {c}.</>,
    scores: {
      card: "Liquidity and price: the index score",
      info: [
        "Each line is a score from 0 to 100, the same one the index uses, overlaid on the BTC price (right axis, log scale). “Liquidity” is the category: the average of **global liquidity** and the **dollar**. **M2** and **stablecoins** are informational: in the backtest they did not anticipate reliably and the index does not use them. Hovering the chart also shows the metric's actual value.",
        "It runs opposite to liquidity: more money in the system (central banks expanding their balance sheets or a weakening dollar) is favorable for BTC and scores low (cheap); less, high (expensive). Each metric is compared with its previous 4 years. They are weekly or monthly data: they change slowly.",
      ],
      category: "Liquidity",
      short: { global_liquidity_roc: "Global liquidity", m2_yoy: "M2", dxy_roc: "DXY dollar", stablecoin_roc: "Stablecoins" },
      metricAria: "Score overlaid on the price",
      infoMetric: "Informational: the index does not use it",
      infoGroup: "Informational: the index does not use them",
      cols: { metric: "Metric", value: "Current value", now: "Today", m1: "1 month ago", m3: "3 months ago" },
      note: "Historical data computed each day without looking ahead (each metric is only compared with its past), not a forecast or investment advice.",
      chartAria: "Chart of the Bitcoin price with the liquidity score overlaid",
    },
    chartLink: "See how liquidity has evolved",
    legend: {
      price: "BTC",
      roc: (d: string) => `Global liquidity (13w) as of ${d}`,
      pending: "not yet",
    },
    today: "Today",
    ahead: "Next 13 weeks",
    note: "Data from FRED (Federal Reserve Bank of St. Louis). Correlation is not causation; not a forecast or investment advice.",
    chartAria: "Chart of the Bitcoin price and the 13-week change in global liquidity, shifted 13 weeks forward",
  },
  charts: {
    tfAria: "Candle size",
    rangeAria: "Period shown",
    ranges: { "3m": "3M", "6m": "6M", "1y": "1Y", "4y": "4Y", all: "All" },
    error: "Could not load data for this timeframe.",
    note: "Historical data, not a prediction or investment advice.",
  },
  vol: {
    title: "Bitcoin volatility",
    rest: "How much the BTC price moves by candle size, with the price overlaid to see how they relate.",
    card: "Realized volatility and price",
    info: [
      "Realized volatility measures how much the price has changed from one candle to the next over the latest candles, annualized so timeframes can be compared.",
      "Calculation window: 24 candles on 1h (one day), 42 on 4h (one week), 30 on 1 day (one month) and 26 on 1 week (half a year). 1h and 4h use Binance candles; 1 day and 1 week, the price history since 2011 plus the current price.",
    ],
    current: (vol: ReactNode, pct: ReactNode, mean: ReactNode) => (
      <>
        Current volatility: {vol} annualized, percentile {pct} of the period shown (average {mean}).
      </>
    ),
    volLegend: "Volatility",
    priceLegend: "Price",
    chartAria: "Chart of Bitcoin's realized volatility and price",
  },
  periods: { "2y": "2Y", "4y": "4Y", "8y": "8Y", all: "Since 2011" },
  periodAria: "Sample period",

  taglineTitle: "Is Bitcoin cheap or expensive?",
  taglineRest: "A 1 to 100 index that combines on‑chain valuation, cycles, liquidity, sentiment and technical analysis.",

  timeframes: {
    "1h": { label: "1 hour", short: "1h" },
    "4h": { label: "4 hours", short: "4h" },
    "1d": { label: "1 day", short: "1D" },
    "1w": { label: "1 week", short: "1W" },
    "1M": { label: "1 month", short: "1M" },
  },
  timeframeAria: "Timeframe",
  timeframeInfo: {
    label: "the timeframe",
    title: "Timeframe",
    body: "Choose the horizon of the analysis. The technical category uses candles of that timeframe and the category weights change: short timeframes weigh technicals and sentiment more; long ones, valuation and cycle.",
    weightsIn: (tf: string) => `Weights for ${tf}:`,
  },

  gauge: { cheap: "Cheap", expensive: "Expensive" },
  capitulation: {
    card: "Recent buyers' capitulation",
    info: [
      "Three questions, in order. **How many are losing?** (stress): short-term holders' supply in loss and adjusted MVRV (coins moved less than 155 days ago). **Are they actually selling at a loss?** (the capitulation itself): their realized loss against its 90-day average and their daily SOPR. **Is there panic?**: the Fear & Greed Index.",
      "The level uses the same rule as the AI analysis. **Capitulation levels**: realized loss of 5 times its average or more with SOPR below 1. **Intense capitulation**: in addition, SOPR of 0.97 or less or a dollar loss in the top 1% of 4 years, as in March 2020, August 2024 or February 2026. The stress and panic questions do not change the level: they explain it.",
      "Capitulations tend to mark the short-term bottom zone, not the day: the decline can continue (in June 2022 it fell another 20%). What usually announces the turn is the exit: SOPR reclaiming 1 and realized loss returning to its average. Daily Bitview data with a one-day lag. Informational: the index does not use it.",
    ],
    levels: { none: "No capitulation", capitulation_levels: "Capitulation levels", intense_capitulation: "Intense capitulation" },
    asOf: (d: string) => `Data for ${d}`,
    reading: {
      none: () => "Recent buyers are not selling at a loss at capitulation levels.",
      capitulation_levels: (p: number) =>
        `Recent buyers are selling at a loss at capitulation levels, though without the intensity of the big ones: SOPR is not below 0.97 and the dollar loss, very high (larger than on ${p}% of days in the last 4 years), stays below that of the big capitulations, which were the largest of their period.`,
      intense_capitulation: () => "Recent buyers are selling at heavy losses, as in the big capitulations.",
    },
    questions: { stress: "How many are losing?", selling: "Selling at a loss?", panic: "Is there panic?" },
    metrics: {
      sthLoss: "Short-term supply in loss",
      mvrv: "Adjusted short-term MVRV",
      realizedLoss: "Short-term realized loss (times its 90-day average)",
      sopr: "Short-term SOPR (day)",
      fearGreed: "Fear & Greed Index",
    },
    over: (v: string) => `over ${v}`,
    under: (v: string) => `under ${v}`,
    atLeast: (v: string) => `${v} or more`,
    soprThreshold: (v: string, intense: string) => `under ${v} (${intense} or less, intense)`,
    cols: { question: "Question", metric: "Metric", now: "Today", threshold: "Threshold" },
    met: "Meets the threshold",
    note: "Historical data, not a forecast or investment advice.",
  },
  momentum: {
    label: "Momentum",
    up: (tf: string, rsi: string) =>
      `Strong bullish momentum on ${tf} (RSI 14 at ${rsi}). Historically, with RSI at 80 or above the rise has tended to continue. Informational: it does not count in the score.`,
    down: (tf: string, rsi: string) =>
      `Strong bearish momentum on ${tf} (RSI 14 at ${rsi}). Historically, with RSI at 20 or below the decline has continued slightly more than half the time. Informational: it does not count in the score.`,
  },
  scoreInfo: {
    label: "the score",
    title: "Score",
    body: "A 1 to 100 index that estimates whether Bitcoin is cheap or expensive. It is the weighted average of the five categories below, stretched so the extremes are reachable; each metric is scored by its historical percentile.",
    disclaimer: "It is for information only, not investment advice.",
  },
  labels: ["Very cheap", "Cheap", "Neutral", "Expensive", "Very expensive"],

  priceInfo: {
    label: "the price",
    title: "Price",
    body: "Latest BTC/USDT price on Binance, taken from the close of the most recent candle. If Binance is unavailable, the daily Coin Metrics price is shown.",
    changeInfo:
      "The percentage is the change since the previous candle's close in the selected timeframe: on 1 hour, since the start of the hour; on 1 day, since 00:00 UTC; on 1 month, month to date.",
    change: (tf: string) => `Change in the current ${tf} candle`,
  },

  refresh: {
    updating: "Updating…",
    next: (countdown: string) => `Updates in ${countdown}`,
  },
  liveError: "No connection to Binance: using the daily technical data.",

  categories: {
    valoracion: {
      name: "On-chain valuation",
      what: "Compares the price with what the network is “worth” according to on-chain data: the average price paid by holders, miner revenue and the 200-day average.",
      read: "It is the backbone of the score and weighs more on long timeframes. High values mean the price is well above its reference value.",
    },
    ciclo: {
      name: "Cycle",
      what: "Places the current moment within the roughly 4-year cycle set by the halvings and relative to Bitcoin's long-term trend.",
      read: "Historically, tops have come 12 to 18 months after the halving and bottoms about 2–2.5 years after.",
    },
    liquidez: {
      name: "Liquidity",
      what: "Measures whether money is flowing into or out of the system: liquidity from the major central banks (Fed, ECB and Bank of Japan) and dollar strength.",
      read: "More liquidity is a tailwind for Bitcoin and lowers the score; less liquidity or a strong dollar raise it.",
    },
    sentimiento: {
      name: "Sentiment",
      what: "Measures investor fear or euphoria with the Fear & Greed Index, short-term holders' SOPR (daily on-chain data) and spot ETF flows, in every timeframe. They are daily data: on 1h and 4h they do not change within the day, so there they weigh as on 1 day.",
      read: "Extreme greed tends to coincide with tops and extreme fear with bottoms, so greed raises the score.",
    },
    tecnico: {
      name: "Technical",
      what: "Price indicators calculated live from the candles of the selected timeframe.",
      read: "It is the part that changes the most and weighs the most on short timeframes (1h, 4h). High values mean overbought.",
    },
  },
  weight: (w: string) => `weight ${w}%`,
  scoreColumns:
    "Each line shows the metric's current value and its score from 0 (cheap) to 100 (expensive), calculated as a percentile against the last 4 years (one halving cycle) unless stated otherwise. A green dot next to the score marks the very cheap zone (10 or below) and a red one, the very expensive zone (90 or above).",
  extreme: { cheap: "Very cheap zone", expensive: "Very expensive zone" },

  metrics: {
    mvrv: {
      name: "MVRV",
      what: "Market Value to Realized Value: market cap divided by realized cap, which values each bitcoin at the price it last moved.",
      read: "Above 3.5 it has marked cycle tops; below 1 the market trades below what holders paid (bottom zone).",
    },
    puell: {
      name: "Puell Multiple",
      what: "How far miners' daily revenue from newly issued bitcoins is above or below its 365-day average.",
      read: "High: miners earn a lot and tend to sell. Low: miner capitulation, historically a buying zone.",
    },
    mayer: {
      name: "Mayer Multiple (vs. 200D MA)",
      what: "Mayer Multiple: how far the price is above or below its 200-day moving average.",
      read: "More than +140% (price at 2.4 times its average) has coincided with bubbles; below the average (negative values), with cheap zones.",
    },
    halving_phase: {
      name: "Halving cycle phase",
      what: "Share of the cycle elapsed since the last halving (April 2024) until the next one, expected in April 2028. At each halving, every ~4 years, the issuance of new bitcoins is cut in half.",
      read: "Historically, tops have come around 33% into the cycle and bottoms around 60%. The score rises approaching the top zone and falls approaching the bottom zone.",
    },
    power_law: {
      name: "Power law deviation",
      what: "How far the price is above or below the long-term trend (power law) Bitcoin has followed since its creation. Measured on a log scale and shown as a percentage.",
      read: "Positive: above the trend (expensive). Negative: below it (cheap).",
    },
    wma200_ratio: {
      name: "Price vs. 200-week MA",
      what: "How far the price is above or below its 200-week moving average (about 4 years, a full cycle).",
      read: "That average has acted as a floor in every cycle: near 0% (price at the average) is a very cheap zone; far above it, euphoria.",
    },
    global_liquidity_roc: {
      name: "Global liquidity (13-week change)",
      what: "13-week change in major central bank liquidity in dollars: Fed net liquidity (balance sheet minus Treasury account and reverse repos) plus the ECB and Bank of Japan balance sheets.",
      read: "If it rises, liquidity flows into markets and lowers the score; if it falls, it raises it. It anticipates BTC returns considerably better than Fed liquidity alone.",
    },
    m2_yoy: {
      name: "US M2 (year-over-year)",
      what: "Year-over-year growth of the US M2 money supply (cash, deposits and equivalents).",
      read: "Monetary expansion favours scarce assets like Bitcoin and lowers the score.",
    },
    dxy_roc: {
      name: "Broad dollar index (13-week change)",
      what: "13-week change in the broad dollar index against major currencies.",
      read: "A strengthening dollar tightens global financial conditions and raises the score.",
    },
    stablecoin_roc: {
      name: "Stablecoin supply (90-day change)",
      what: "90-day growth of the total stablecoin supply (USDT, USDC…), money ready to enter crypto.",
      read: "If it grows, there is more “dry powder” available and it lowers the score.",
    },
    fear_greed: {
      name: "Fear & Greed Index",
      what: "Alternative.me's Crypto Fear & Greed Index: combines volatility, volume, social media, dominance and search trends. Ranges from 0 (extreme fear) to 100 (extreme greed).",
      read: "It is used directly as the score.",
    },
    sth_sopr: {
      name: "Short-term SOPR (7d)",
      what: "Spent Output Profit Ratio of short-term holders (coins younger than 150 days), 7-day average: selling price divided by purchase price of the coins that moved. +1% means they sold at a 1% profit on average. On-chain data from Bitview.",
      read: "Percentile versus the last 4 years. High: recent buyers are taking profits, typical of euphoric markets (adds). Low: they sell at a loss, the capitulation typical of bottoms (subtracts).",
    },
    etf_flows: {
      name: "Spot ETF flows (20 sessions)",
      what: "Inflows minus outflows of US spot bitcoin ETFs over the last 20 sessions (about a month), in BTC. Data from The Commoner Bitcoin ETF Tracker (TFTC), since January 2024.",
      read: "Percentile versus its history. Strong inflows, typical of tops, add; outflows, typical of lows, subtract. With less than three years of data, it is still a lightly tested signal.",
    },
    open_interest: {
      name: "Open interest",
      what: "Bitcoins in open perpetual futures contracts on Binance: how much leverage there is in the market.",
      read: "Scored by its percentile over the last 30 days. High: a lot of leverage has built up, which tends to end in sharp moves and liquidations (raises the score). Low: the market has deleveraged (lowers it).",
    },
    long_short: {
      name: "Accounts in long",
      what: "Of the Binance accounts with a BTC futures position, the share betting on a rise (long). 50% is the balance between longs and shorts.",
      read: "Scored by its percentile over the last 30 days. Read as a contrarian signal: when almost everyone is betting on a rise, the market is crowded with buyers (raises the score); when shorts dominate, the opposite (lowers it).",
    },
    taker_ratio: {
      name: "Market buys",
      what: "Of the volume traded with market orders on Binance futures, the share that were buys (average of the last 3 candles). Shows who is in a hurry to get in or out. 50% is the balance.",
      read: "Scored by its percentile over the last 30 days. Above 50%, aggressive buying dominates (raises the score); below 50%, selling does (lowers it).",
    },
    rsi_14: {
      name: "RSI 14",
      what: "14-candle Relative Strength Index: compares the strength of recent gains with that of recent losses.",
      read: "Above 70, overbought; below 30, oversold. Scores 0 at RSI 30 or below and 100 at RSI 70 or above.",
    },
    bollinger: {
      name: "Bollinger %B (20, 2)",
      what: "Position of the price within the Bollinger Bands (20-candle average ± 2 standard deviations).",
      read: "100: at the upper band (stretched up). 0: at the lower band (stretched down).",
    },
    ma200_ratio: {
      name: "Price vs. 200 MA (percentile)",
      what: "How far the price is above or below its 200-candle average in the selected timeframe, compared with the last 1,000 candles.",
      read: "The score is the percentile: high means the price is further from its average than usual.",
    },
    ma48_ratio: {
      name: "Price vs. 48-month MA (percentile)",
      what: "How far the price is above or below its 48 monthly candle average (4 years, one halving cycle), compared with the whole monthly history since 2011. On the monthly timeframe this average replaces the 200-candle one, which would be 16 years.",
      read: "The score is the percentile: high means the price is further from its average than usual.",
    },
  },

  history: {
    title: "Daily score history vs. price",
    title4h: "4h score history vs. price",
    score4h: "4h score",
    fearGreed: "Fear & Greed Index (0 = extreme fear, 100 = extreme greed)",
    loading4h: "Loading 4h candles…",
    info4h: "In “6 months”, 4-hour candles are shown with that timeframe's score, recomputed with what was known at each candle.",
    infoLabel: "the history",
    infoTitle: "History",
    info1: "Top: Bitcoin's price on a log scale; bottom: the daily score. The green and red bands mark the very cheap (≤20) and very expensive (≥80) zones.",
    info2: "Each day is calculated only with the data available up to that day, so the history shows what the score would have read at the time. The high and low of the visible range are marked.",
    ranges: { "6m": "6M", "1y": "1Y", "4y": "4Y", all: "All" },
    rangeAria: "History range",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    price: "Price",
    chartAria: "Historical chart of Bitcoin's price and the score",
    resizePrice: "Price chart height",
    resizeScore: "Score chart height",
    resizeTitle: "Drag to change the height · double-click to reset",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    max: "High",
    min: "Low",
    hint: (
      <>
        Drag the chart to pan · Ctrl + wheel, pinch or <kbd>+</kbd>/<kbd>−</kbd> to zoom · drag the bars{" "}
        <span aria-hidden="true">═</span> to change the height of each chart
      </>
    ) as ReactNode,
  },

  outlook: {
    title: "What the price did next",
    info: [
      "The table takes the days in the history with a daily score similar to today's (±7.5 points) and measures how much the price had changed after each period.",
      "Nearby days are very similar to each other, so they are grouped into episodes: sample days less than a month apart belong to the same episode. The real sample size is the number of episodes, not of days.",
      "Time in a zone is measured with the score's 30-day average, because the daily value is too noisy: in a few weeks it can cross several zones.",
      '"2Y" (2 years) shows only the most recent market and has very few episodes; "4Y" (one cycle) is closest to today\'s market but has few episodes; "8Y" (about two cycles) balances similarity and sample size; "Since 2011" has the most episodes but includes the extreme rallies of the early years.',
    ],
    infoNote:
      "The historical score uses a power law regression fitted on all the data, so past results look somewhat better than what the score would have shown at the time. It describes the past; it does not predict the future.",
    today: (score: ReactNode, label: string, zone: string, days: number, share: ReactNode) => (
      <>
        The daily score is at {score} ({label}, zone {zone}). Over the last {days} days it has been in that zone {share} of the
        time.
      </>
    ),
    smooth: (days: number, value: ReactNode, label: string, streak: ReactNode, streakDays: number, zone: string, since: string) => (
      <>
        Its {days}-day average is at {value} ({label}) and has been in the {zone} zone for {streak}{" "}
        {streakDays === 1 ? "day" : "consecutive days"}, since {since}.
      </>
    ),
    past: (count: number, longer: number, median: string) =>
      ` Of ${count} previous ${count === 1 ? "streak" : "streaks"} in that zone, ${
        longer === 0 ? "none lasted longer" : `${longer} lasted longer`
      } (median ${median} days).`,
    sample: (lo: string, hi: string) => `Days with a daily score between ${lo} and ${hi}: what the price did next.`,
    horizons: { 30: "1 month", 90: "3 months", 180: "6 months", 365: "1 year" },
    cols: { horizon: "Period", median: "Median", rose: "Rose", range: "Worst / best", sample: "Sample" },
    notEnough: "Not enough data",
    days: (n: number) => `${n} days`,
    episodes: (n: number) => `${n} ${n === 1 ? "episode" : "episodes"}`,
    vol: (value: ReactNode, pct: ReactNode) => (
      <>
        30-day volatility: {value} annualized, percentile {pct} of the last 4 years.
      </>
    ),
    volLow: " Volatility this low tends to precede a strong move, but says nothing about its direction.",
    volHigh: " Volatility this high tends to come with sharp drops or vertical rallies.",
    note: "Historical data, not a prediction or investment advice.",
  },

  moves: {
    title: "Drops from highs and rallies from lows",
    info: [
      "Counts the days since the last drop and the last rally of each size, using daily closes plus the current price as the latest point, and compares them with what is typical in the selected period: how many days it had usually been on any given day (the median).",
      "A 10% drop is counted when the close falls 10% below the high reached since the previous drop of that size; from there, it is measured again. Rallies work the same way from the low. Since Bitcoin trades 24h, each daily candle opens at the previous close, so this is equivalent to measuring from open to close.",
      "The average time between two moves is not used because these moves come in bursts (several 5% drops in the same sell-off), which makes that average misleadingly short.",
      "The bar shows the share of days in the period that had gone less time without that move than today; the middle mark is the typical value. In orange, those beyond 90% of days.",
    ],
    infoNote:
      "Going longer than average without a move does not mean it is about to happen: these moves do not follow a schedule, and quiet phases tend to last.",
    drops: "Drops from highs",
    rallies: "Rallies from lows",
    cols: { size: "Size", since: "Days since", typical: "Typical" },
    days: (n: number) => (n === 0 ? "Today" : `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`),
    count: (n: number) => `${n} ${n === 1 ? "time" : "times"} in the period`,
    none: "None in the period",
    percentile: (p: number) => `Longer without happening than on ${p}% of days in the period`,
    overDrops: (list: string) => `Drops of ${list} have gone longer without happening than on 90% of days in the period.`,
    overRallies: (list: string) => `Rallies of ${list} have gone longer without happening than on 90% of days in the period.`,
    allNormal: "No drop or rally has gone an unusually long time without happening.",
    note: "Historical data, not a prediction or investment advice.",
  },

  calendar: {
    title: "This week's economic calendar",
    info: [
      "This week's economic data and central bank decisions most likely to move markets and the BTC price: high- and medium-impact US releases (plus ADP employment), the euro area flash CPI and the rate decisions of the ECB, the Bank of Japan, the Bank of England and China.",
      "Times are in your time zone. Forecast is what the market expects; previous, the last published figure. The price moves most when the data misses the forecast. The actual figure for US events comes from FRED as soon as it publishes it, usually the same day.",
    ],
    forecast: "Fcst.",
    previous: "Prev.",
    actual: "Actual",
    countries: { USD: "US", EUR: "Eurozone", JPY: "Japan", GBP: "UK", CNY: "China" },
    note: "Sources: Forex Factory and FRED.",
  },

  feed: { title: "News and calendar", tabs: { news: "Latest news", calendar: "This week's calendar" } },
  news: {
    title: "Latest market news",
    info: [
      "Recent headlines from Cointelegraph, CoinDesk, Investing.com, CNBC, BBC and the Federal Reserve. Every 15 minutes during market hours (hourly otherwise), an AI model rates them by their likely short-term impact on the BTC price and drops duplicates.",
      "It shows the 10 with the most impact over the last 48 hours, giving priority to the most recent. Each headline links to the original story; the automatic selection may contain errors. The colour dot shows the estimated impact:",
    ],
    levels: { high: "High impact", mid: "Medium impact", low: "Moderate impact" },
    categories: {
      geopolitica: "Geopolitics",
      macro: "Macro",
      crisis: "Crisis",
      mercados: "Markets",
      flujos: "Flows",
      cripto: "Crypto",
    },
    // Los titulares se muestran en inglés: solo cuenta la selección
    note: (selection: string[], _translation: string[]) => (selection.length ? `Selected by ${list(selection)}.` : "Selected by AI."),
  },

  donate: {
    title: "Support the project",
    infoLabel: "donations",
    infoTitle: "Donations",
    info1: "Is BTC Cheap? is free and ad-free. Donations are voluntary and help cover the domain and development time; they do not unlock anything extra.",
    info2: "Wallet addresses are public: any payment to them is recorded on the blockchain.",
    coffee: "If you find it useful, you can buy me a coffee ☕",
    paypal: "Donate with PayPal",
    networkAria: "Network",
    qrAria: "QR code of the address",
    copy: "Copy",
    copied: "Copied!",
    openWallet: "Open in wallet",
    hints: {
      btc: "Bitcoin network (on-chain). Only send BTC to this address.",
      ln: "Lightning Network: instant, almost fee-free payments, ideal for small amounts.",
    },
  },

  footer: {
    dataAsOf: (asOf: string, updated: string) =>
      `On-chain, cycle and liquidity data as of ${asOf} (recalculated once a day; last run ${updated}).`,
    missing: (list: string) => ` Sources unavailable today: ${list}.`,
    sources: "Sources:",
    attribution: { "https://www.binance.com/": "Binance (live price and derivatives)" },
    disclaimer: "This indicator is for information only and is not financial advice.",
    credit: "Built by",
    legalAria: "Legal information",
  },
};
