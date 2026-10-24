import type { ReactNode } from "react";
import type { Messages } from "./es";

export const en: Messages = {
  loading: "Loading…",
  noData: "No data",
  dataError: "Could not load the daily data. Run the pipeline (python pipeline/build.py).",
  infoAbout: (label: string) => `About ${label}`,
  percent: (n: string) => `${n}%`,
  language: "Language",

  tagline: "Is Bitcoin cheap or expensive? A 1 to 100 index that combines on-chain valuation, cycles, liquidity, sentiment and technical analysis.",

  timeframes: {
    "15m": { label: "15 minutes", short: "15m" },
    "1h": { label: "1 hour", short: "1h" },
    "4h": { label: "4 hours", short: "4h" },
    "1d": { label: "1 day", short: "1D" },
    "1w": { label: "1 week", short: "1W" },
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
    next: (countdown: string) => `Next update in ${countdown}`,
    now: "Update now",
    infoLabel: "updates",
    infoTitle: "Updates",
    info1: (interval: string) =>
      `Technicals and funding update automatically every ${interval} in this timeframe. When you switch timeframes, data already downloaded is reused while it is still fresh.`,
    info2: "On-chain, cycle and liquidity metrics are recalculated once a day. The ↻ button forces a full reload.",
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
      what: "Measures investor fear or euphoria and leverage in the futures markets.",
      read: "Extreme greed tends to coincide with tops and extreme fear with bottoms, so greed raises the score.",
    },
    tecnico: {
      name: "Technical",
      what: "Price indicators calculated live from the candles of the selected timeframe.",
      read: "It is the part that changes the most and weighs the most on short timeframes (15m, 1h). High values mean overbought.",
    },
  },
  weight: (w: string) => `weight ${w}%`,
  scoreColumns:
    "Each line shows the metric's current value and its score from 0 (cheap) to 100 (expensive), calculated as a percentile against the last 4 years (one halving cycle) unless stated otherwise.",

  metrics: {
    mvrv: {
      name: "MVRV",
      what: "Market Value to Realized Value: market cap divided by realized cap, which values each bitcoin at the price it last moved.",
      read: "Above 3.5 it has marked cycle tops; below 1 the market trades below what holders paid (bottom zone).",
    },
    puell: {
      name: "Puell Multiple",
      what: "Miners' daily revenue from newly issued bitcoins divided by its 365-day average.",
      read: "High: miners earn a lot and tend to sell. Low: miner capitulation, historically a buying zone.",
    },
    mayer: {
      name: "Mayer Multiple (price / 200D MA)",
      what: "Mayer Multiple: price divided by its 200-day moving average.",
      read: "Above 2.4 it has coincided with bubbles; below 1, with cheap zones.",
    },
    halving_phase: {
      name: "Halving cycle phase",
      what: "Position within the cycle between two halvings (every ~4 years the issuance of new bitcoins is cut in half).",
      read: "The value is already a score: it rises towards the phase where tops have historically formed and falls towards the phase of bottoms.",
    },
    power_law: {
      name: "Power law deviation",
      what: "How far the price is above or below the long-term trend (power law) Bitcoin has followed since its creation. Measured on a log scale and shown as a percentage.",
      read: "Positive: above the trend (expensive). Negative: below it (cheap).",
    },
    wma200_ratio: {
      name: "Price / 200-week MA",
      what: "Price divided by the 200-week moving average (about 4 years, a full cycle).",
      read: "That average has acted as a floor in every cycle: near 1 is a very cheap zone; far above it, euphoria.",
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
      name: "Price / 200 MA (percentile)",
      what: "Price divided by its 200-candle average in the selected timeframe, compared with the last 1,000 candles.",
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
      '"Last 4 years" (one cycle) is closest to today\'s market but has few episodes; "Last 8 years" (about two cycles) balances similarity and sample size; "Since 2011" has the most episodes but includes the extreme rallies of the early years.',
    ],
    infoNote:
      "The historical score uses a power law regression fitted on all the data, so past results look somewhat better than what the score would have shown at the time. It describes the past; it does not predict the future.",
    periods: { "4y": "Last 4 years", "8y": "Last 8 years", all: "Since 2011" },
    periodAria: "Sample period",
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
