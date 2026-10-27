import type { ReactNode } from "react";
import type { Messages } from "./es";

export const en: Messages = {
  loading: "Loading…",
  noData: "No data",
  dataError: "Could not load the daily data. Run the pipeline (python pipeline/build.py).",
  infoAbout: (label: string) => `About ${label}`,
  percent: (n: string) => `${n}%`,
  language: "Language",
  periods: { "2y": "2 years", "4y": "4 years", "8y": "8 years", all: "Since 2011" },
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
  },

  refresh: {
    updating: "Updating…",
    next: (countdown: string) => `Updates in ${countdown}`,
    infoLabel: "updates",
    infoTitle: "Updates",
    info1: (interval: string) =>
      `Technicals and funding update automatically every ${interval} in this timeframe. When you switch timeframes, data already downloaded is reused while it is still fresh.`,
    info2: "On-chain, cycle and liquidity metrics are recalculated once a day.",
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
      what: "Measures whether money is flowing into or out of the system: Federal Reserve liquidity, M2 money supply, dollar strength and stablecoin supply.",
      read: "More liquidity is a tailwind for Bitcoin and lowers the score; less liquidity or a strong dollar raise it.",
    },
    sentimiento: {
      name: "Sentiment",
      what: "Measures investor fear or euphoria and leverage in the futures markets. On 1h and 4h it uses Binance derivatives (open interest, long/short and buy/sell ratios, and funding), which move at that pace; on 1 day, 1 week and 1 month, the Fear & Greed Index, which is daily, and funding.",
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
    net_liquidity_roc: {
      name: "Fed net liquidity (13-week change)",
      what: "13-week change in the Fed's net liquidity: the Federal Reserve balance sheet minus the Treasury account and reverse repos.",
      read: "If it rises, liquidity flows into markets and lowers the score; if it falls, it raises it.",
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
    funding: {
      name: "Perpetual funding rate (Binance)",
      what: "Funding rate of Binance perpetual futures: the periodic payment (every 8h) between long and short positions.",
      read: "0.01% is neutral. Strongly positive means excess bullish leverage (raises the score); negative means pessimism (lowers it).",
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
    infoLabel: "the history",
    infoTitle: "History",
    info1: "Top: Bitcoin's price on a log scale; bottom: the daily score. The green and red bands mark the very cheap (≤20) and very expensive (≥80) zones.",
    info2: "Each day is calculated only with the data available up to that day, so the history shows what the score would have read at the time. The high and low of the visible range are marked.",
    ranges: { "1m": "1M", "1y": "1Y", "4y": "4Y", all: "All" },
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
      '"2 years" shows only the most recent market and has very few episodes; "4 years" (one cycle) is closest to today\'s market but has few episodes; "8 years" (about two cycles) balances similarity and sample size; "Since 2011" has the most episodes but includes the extreme rallies of the early years.',
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
      "This week's economic data and central bank decisions most likely to move markets and the BTC price: high-impact US releases and the rate decisions of the ECB, the Bank of Japan, the Bank of England and China.",
      "Times are in your time zone. Forecast is what the market expects; previous, the last published figure. The price moves most when the data misses the forecast.",
    ],
    forecast: "Fcst.",
    previous: "Prev.",
    countries: { USD: "US", EUR: "Eurozone", JPY: "Japan", GBP: "UK", CNY: "China" },
    note: "Source: Forex Factory.",
  },

  news: {
    title: "Latest market news",
    info: [
      "Recent headlines from Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC, BBC and the Federal Reserve. Every 15 minutes during market hours (hourly otherwise), an AI model rates them by their likely short-term impact on the BTC price and drops duplicates.",
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
    note: "Selected by AI.",
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
    attribution: { "https://www.binance.com/": "Binance (live price and funding)" },
    disclaimer: "This indicator is for information only and is not financial advice.",
    credit: "Built by",
  },
};
