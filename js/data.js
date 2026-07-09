/* ============================================================
   APEX TERMINAL — simulated market data engine
   Deterministic seeded random walks; no network, no real feed.
   ============================================================ */

"use strict";

/* ---------- seeded PRNG ---------- */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* approx standard normal from three uniforms */
function gauss(rnd) {
  return (rnd() + rnd() + rnd() - 1.5) * 2;
}

/* ---------- security universe ---------- */

const SECURITIES = [
  // -- equities --
  { sym: "AAPL",   name: "Apple Inc",             type: "Equity", sector: "Technology",        country: "US", base: 214.35,  vol: 0.016, drift: 0.00055, dec: 2, cap: 3.28e12, pe: 33.4, dy: 0.42, emp: "164,000", exch: "NASDAQ GS",
    desc: "Designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services including cloud, payments and streaming media." },
  { sym: "MSFT",   name: "Microsoft Corp",        type: "Equity", sector: "Technology",        country: "US", base: 468.12,  vol: 0.015, drift: 0.00060, dec: 2, cap: 3.48e12, pe: 38.1, dy: 0.66, emp: "228,000", exch: "NASDAQ GS",
    desc: "Develops and licenses software, services, devices and solutions worldwide; segments include Productivity & Business Processes, Intelligent Cloud and More Personal Computing." },
  { sym: "NVDA",   name: "NVIDIA Corp",           type: "Equity", sector: "Semiconductors",    country: "US", base: 162.88,  vol: 0.028, drift: 0.00110, dec: 2, cap: 3.97e12, pe: 51.7, dy: 0.03, emp: "29,600",  exch: "NASDAQ GS",
    desc: "Designs graphics processing units and system-on-chip units for gaming, professional visualization, data-center AI compute and automotive markets." },
  { sym: "AMZN",   name: "Amazon.com Inc",        type: "Equity", sector: "Consumer Disc",     country: "US", base: 223.4,   vol: 0.019, drift: 0.00050, dec: 2, cap: 2.37e12, pe: 36.2, dy: 0.00, emp: "1,556,000", exch: "NASDAQ GS",
    desc: "Engages in retail sale of consumer products and subscriptions, and provides cloud computing via Amazon Web Services across North America and internationally." },
  { sym: "GOOGL",  name: "Alphabet Inc-A",        type: "Equity", sector: "Communication",     country: "US", base: 181.2,   vol: 0.017, drift: 0.00045, dec: 2, cap: 2.21e12, pe: 20.6, dy: 0.45, emp: "183,000", exch: "NASDAQ GS",
    desc: "Provides online advertising, search, cloud computing, software and hardware through Google Services, Google Cloud and Other Bets segments." },
  { sym: "META",   name: "Meta Platforms Inc",    type: "Equity", sector: "Communication",     country: "US", base: 726.5,   vol: 0.021, drift: 0.00065, dec: 2, cap: 1.83e12, pe: 28.4, dy: 0.28, emp: "74,000",  exch: "NASDAQ GS",
    desc: "Builds products for connection and sharing via mobile devices, PCs, VR and wearables — Facebook, Instagram, Messenger, WhatsApp — plus Reality Labs hardware." },
  { sym: "TSLA",   name: "Tesla Inc",             type: "Equity", sector: "Automobiles",       country: "US", base: 297.8,   vol: 0.034, drift: 0.00030, dec: 2, cap: 9.58e11, pe: 162.3, dy: 0.00, emp: "125,000", exch: "NASDAQ GS",
    desc: "Designs, manufactures and sells electric vehicles and energy generation & storage systems, and offers related services including autonomous-driving software." },
  { sym: "JPM",    name: "JPMorgan Chase & Co",   type: "Equity", sector: "Banks",             country: "US", base: 289.1,   vol: 0.013, drift: 0.00040, dec: 2, cap: 8.05e11, pe: 14.1, dy: 1.94, emp: "317,000", exch: "NYSE",
    desc: "Global financial services firm active in investment banking, consumer & community banking, commercial banking and asset & wealth management." },
  { sym: "GS",     name: "Goldman Sachs Group",   type: "Equity", sector: "Capital Markets",   country: "US", base: 702.3,   vol: 0.016, drift: 0.00042, dec: 2, cap: 2.16e11, pe: 16.2, dy: 1.71, emp: "46,500",  exch: "NYSE",
    desc: "Provides investment banking, securities trading, asset management and consumer banking services to corporations, institutions, governments and individuals." },
  { sym: "XOM",    name: "Exxon Mobil Corp",      type: "Equity", sector: "Energy",            country: "US", base: 113.6,   vol: 0.015, drift: 0.00020, dec: 2, cap: 4.89e11, pe: 14.8, dy: 3.45, emp: "61,000",  exch: "NYSE",
    desc: "Explores for and produces crude oil and natural gas, and manufactures, trades and sells petroleum products and petrochemicals worldwide." },
  { sym: "JNJ",    name: "Johnson & Johnson",     type: "Equity", sector: "Pharmaceuticals",   country: "US", base: 156.9,   vol: 0.010, drift: 0.00022, dec: 2, cap: 3.78e11, pe: 17.5, dy: 3.31, emp: "138,000", exch: "NYSE",
    desc: "Researches, develops and sells pharmaceutical products and medical devices in the fields of immunology, oncology, neuroscience, cardiovascular and surgery." },
  { sym: "V",      name: "Visa Inc-A",            type: "Equity", sector: "Payments",          country: "US", base: 355.4,   vol: 0.012, drift: 0.00045, dec: 2, cap: 6.94e11, pe: 32.0, dy: 0.66, emp: "31,600",  exch: "NYSE",
    desc: "Operates VisaNet, a global payments network enabling authorization, clearing and settlement of payment transactions across more than 200 countries." },
  { sym: "NFLX",   name: "Netflix Inc",           type: "Equity", sector: "Entertainment",     country: "US", base: 1284.6,  vol: 0.022, drift: 0.00070, dec: 2, cap: 5.46e11, pe: 50.9, dy: 0.00, emp: "14,000",  exch: "NASDAQ GS",
    desc: "Provides subscription streaming entertainment — TV series, documentaries, feature films and games — to members in over 190 countries." },
  { sym: "AMD",    name: "Advanced Micro Devices", type: "Equity", sector: "Semiconductors",   country: "US", base: 138.4,   vol: 0.030, drift: 0.00040, dec: 2, cap: 2.24e11, pe: 45.8, dy: 0.00, emp: "26,000",  exch: "NASDAQ GS",
    desc: "Designs microprocessors, GPUs and adaptive SoC products for data centers, PCs, gaming and embedded markets." },

  // -- indices --
  { sym: "SPX",  name: "S&P 500 Index",        type: "Index", sector: "US Large Cap",  country: "US", base: 6280.5,  vol: 0.010, drift: 0.00038, dec: 2, exch: "CME",
    desc: "Capitalization-weighted index of 500 leading US companies, covering approximately 80% of available US market capitalization." },
  { sym: "INDU", name: "Dow Jones Indus. Avg", type: "Index", sector: "US Blue Chip",  country: "US", base: 44560.2, vol: 0.009, drift: 0.00030, dec: 2, exch: "CBOT",
    desc: "Price-weighted average of 30 blue-chip US stocks, the oldest continuing US market index." },
  { sym: "CCMP", name: "NASDAQ Composite",     type: "Index", sector: "US Technology", country: "US", base: 20630.7, vol: 0.013, drift: 0.00048, dec: 2, exch: "NASDAQ",
    desc: "Market-cap-weighted index of more than 3,000 securities listed on the NASDAQ stock market." },
  { sym: "RTY",  name: "Russell 2000 Index",   type: "Index", sector: "US Small Cap",  country: "US", base: 2248.6,  vol: 0.014, drift: 0.00020, dec: 2, exch: "ICE",
    desc: "Small-capitalization US equity benchmark comprising the smallest 2,000 members of the Russell 3000." },
  { sym: "DAX",  name: "DAX Index",            type: "Index", sector: "Germany",       country: "DE", base: 24480.9, vol: 0.011, drift: 0.00032, dec: 2, exch: "XETRA",
    desc: "Total-return index of the 40 largest and most liquid German companies trading on the Frankfurt exchange." },
  { sym: "UKX",  name: "FTSE 100 Index",       type: "Index", sector: "UK Large Cap",  country: "GB", base: 8920.4,  vol: 0.009, drift: 0.00018, dec: 2, exch: "LSE",
    desc: "Capitalization-weighted index of the 100 most highly capitalized companies on the London Stock Exchange." },
  { sym: "NKY",  name: "Nikkei 225",           type: "Index", sector: "Japan",         country: "JP", base: 39810.3, vol: 0.012, drift: 0.00028, dec: 2, exch: "TSE",
    desc: "Price-weighted average of 225 top-rated Japanese companies listed in the First Section of the Tokyo Stock Exchange." },
  { sym: "HSI",  name: "Hang Seng Index",      type: "Index", sector: "Hong Kong",     country: "HK", base: 24120.8, vol: 0.015, drift: 0.00015, dec: 2, exch: "HKEX",
    desc: "Free-float capitalization-weighted index of the largest companies trading on the Hong Kong Stock Exchange." },

  // -- FX --
  { sym: "EURUSD", name: "Euro / US Dollar",       type: "Curncy", sector: "G10 FX", country: "EU", base: 1.1735, vol: 0.0042, drift: 0.00002, dec: 4, exch: "COMP",
    desc: "Spot exchange rate — the price of one euro expressed in US dollars. The most actively traded currency pair in the world." },
  { sym: "USDJPY", name: "US Dollar / Yen",        type: "Curncy", sector: "G10 FX", country: "JP", base: 146.22, vol: 0.0050, drift: 0.00001, dec: 2, exch: "COMP",
    desc: "Spot exchange rate — the price of one US dollar expressed in Japanese yen." },
  { sym: "GBPUSD", name: "British Pound / USD",    type: "Curncy", sector: "G10 FX", country: "GB", base: 1.3590, vol: 0.0046, drift: 0.00001, dec: 4, exch: "COMP",
    desc: "Spot exchange rate — the price of one pound sterling expressed in US dollars; known in markets as 'cable'." },
  { sym: "DXY",    name: "US Dollar Index",        type: "Curncy", sector: "Dollar",  country: "US", base: 97.45,  vol: 0.0038, drift: -0.00001, dec: 3, exch: "ICE",
    desc: "Geometric weighted index of the US dollar's value against a basket of six major world currencies." },

  // -- commodities --
  { sym: "CL1", name: "WTI Crude Oil (Generic)", type: "Comdty", sector: "Energy",          country: "US", base: 68.35,  vol: 0.021, drift: 0.00005, dec: 2, exch: "NYMEX",
    desc: "Generic first-month West Texas Intermediate light sweet crude oil futures contract, deliverable at Cushing, Oklahoma. Quoted in USD per barrel." },
  { sym: "GC1", name: "Gold (Generic Future)",   type: "Comdty", sector: "Precious Metals", country: "US", base: 3335.4, vol: 0.011, drift: 0.00035, dec: 2, exch: "COMEX",
    desc: "Generic first-month COMEX gold futures contract. Quoted in USD per troy ounce." },
  { sym: "NG1", name: "Natural Gas (Generic)",   type: "Comdty", sector: "Energy",          country: "US", base: 3.42,   vol: 0.036, drift: 0.00000, dec: 3, exch: "NYMEX",
    desc: "Generic first-month Henry Hub natural gas futures contract. Quoted in USD per million British thermal units." },

  // -- crypto --
  { sym: "BTC", name: "Bitcoin / USD",  type: "Crypto", sector: "Digital Assets", country: "--", base: 109250, vol: 0.032, drift: 0.00080, dec: 0, exch: "COMP",
    desc: "The largest cryptocurrency by market value — a decentralized digital asset recorded on a proof-of-work blockchain. Trades continuously, 24/7." },
  { sym: "ETH", name: "Ethereum / USD", type: "Crypto", sector: "Digital Assets", country: "--", base: 2595.7, vol: 0.041, drift: 0.00055, dec: 2, exch: "COMP",
    desc: "Native asset of the Ethereum network, a programmable proof-of-stake blockchain supporting smart contracts and decentralized applications." },
];

/* ---------- history generation ---------- */

const DAYS = 1260;          // ~5y of trading days
const INTRA_START = 390;    // minutes already elapsed in today's session

const DAY_MS = 86400000;

function tradingDays(n) {
  // n most recent weekdays, ending yesterday, as ms timestamps (midnight local)
  const out = [];
  let d = new Date(); d.setHours(0, 0, 0, 0);
  d = new Date(d.getTime() - DAY_MS); // start yesterday
  while (out.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(d.getTime());
    d = new Date(d.getTime() - DAY_MS);
  }
  return out.reverse();
}

const TRADING_DAYS = tradingDays(DAYS);

function genDaily(sec) {
  const rnd = mulberry32(hashSeed(sec.sym));
  const bars = [];
  let prev = sec.base; // rescaled after the walk
  for (let i = 0; i < DAYS; i++) {
    const ret = sec.drift + sec.vol * gauss(rnd);
    const c = prev * Math.exp(ret);
    const o = prev * Math.exp(sec.vol * 0.35 * gauss(rnd));
    const h = Math.max(o, c) * (1 + sec.vol * 0.45 * rnd());
    const l = Math.min(o, c) * (1 - sec.vol * 0.45 * rnd());
    const v = Math.round((0.6 + rnd() * 0.9) * 1e7 * (0.5 + Math.abs(ret) / sec.vol));
    bars.push({ t: TRADING_DAYS[i], o, h, l, c, v });
    prev = c;
  }
  // rescale so the final close lands exactly on the configured base price
  const k = sec.base / bars[bars.length - 1].c;
  for (const b of bars) { b.o *= k; b.h *= k; b.l *= k; b.c *= k; }
  return bars;
}

function genIntraday(sec, prevClose) {
  const rnd = mulberry32(hashSeed(sec.sym + ":intraday"));
  const stepVol = sec.vol / Math.sqrt(390);
  const now = Date.now();
  const start = now - INTRA_START * 60000;
  let px = prevClose * Math.exp(sec.vol * 0.25 * gauss(rnd)); // opening gap
  const pts = [];
  for (let i = 0; i < INTRA_START; i++) {
    px *= Math.exp(stepVol * gauss(rnd));
    pts.push({ t: start + i * 60000, v: px });
  }
  return pts;
}

/* ---------- live market state ---------- */

const MKT = {
  secs: new Map(),   // sym -> state
  order: SECURITIES.map(s => s.sym),

  init() {
    for (const meta of SECURITIES) {
      const daily = genDaily(meta);
      const prevClose = daily[daily.length - 1].c;
      const intra = genIntraday(meta, prevClose);
      const last = intra[intra.length - 1].v;
      const vals = intra.map(p => p.v);
      const yr = daily.slice(-252);
      this.secs.set(meta.sym, {
        meta, daily, intra,
        last, prevClose,
        open: intra[0].v,
        dayHi: Math.max(...vals),
        dayLo: Math.min(...vals),
        vol: Math.round(daily[daily.length - 1].v * (0.4 + Math.random() * 0.4)),
        hi52: Math.max(...yr.map(b => b.h)),
        lo52: Math.min(...yr.map(b => b.l)),
        rnd: mulberry32(hashSeed(meta.sym + ":live") ^ (Date.now() & 0xffff)),
        dir: 0,
      });
    }
  },

  get(sym) { return this.secs.get(sym); },
  has(sym) { return this.secs.has(sym); },

  chg(s)    { return s.last - s.prevClose; },
  chgPct(s) { return (s.last / s.prevClose - 1) * 100; },

  /* one live tick across the whole universe */
  tick() {
    for (const s of this.secs.values()) {
      const stepVol = s.meta.vol / 42; // ~per-tick volatility
      const prev = s.last;
      s.last = prev * Math.exp(stepVol * gauss(s.rnd));
      s.dir = s.last > prev ? 1 : s.last < prev ? -1 : 0;
      s.dayHi = Math.max(s.dayHi, s.last);
      s.dayLo = Math.min(s.dayLo, s.last);
      s.vol += Math.round(s.rnd() * 40000);
      // extend the intraday line: update last point, append a new one each minute
      const tail = s.intra[s.intra.length - 1];
      if (Date.now() - tail.t >= 60000) {
        s.intra.push({ t: Date.now(), v: s.last });
        if (s.intra.length > 480) s.intra.shift();
      } else {
        tail.v = s.last;
      }
    }
  },

  /* chart series for a range; returns {pts, bars} (bars only for daily ranges) */
  series(sym, range) {
    const s = this.secs.get(sym);
    if (!s) return null;
    if (range === "1D") {
      return { pts: s.intra.map(p => ({ t: p.t, v: p.v })), bars: null, intraday: true };
    }
    const n = { "1M": 21, "6M": 126, "1Y": 252, "5Y": DAYS }[range] || 252;
    const bars = s.daily.slice(-n).map(b => ({ ...b }));
    // append today's live bar
    bars.push({ t: Date.now(), o: s.open, h: s.dayHi, l: s.dayLo, c: s.last, v: s.vol });
    return { pts: bars.map(b => ({ t: b.t, v: b.c })), bars, intraday: false };
  },

  movers() {
    return [...this.secs.values()]
      .filter(s => s.meta.type === "Equity")
      .sort((a, b) => Math.abs(this.chgPct(b)) - Math.abs(this.chgPct(a)));
  },

  byType(type) {
    return [...this.secs.values()].filter(s => s.meta.type === type);
  },
};

/* ---------- news wire ---------- */

const NEWS_TEMPLATES = [
  "{NAME} {DIR} {PCT}% as volume runs {VOLX}x the 20-day average",
  "{SYM} options desks report heavy {SIDE} flow ahead of expiry",
  "Street wrap: analysts split on {NAME} after {DIR2} quarter",
  "{NAME} said to weigh strategic options for underperforming unit",
  "Flows: institutions add to {SYM} positions for a third straight session",
  "{NAME} {DIR} after guidance update; desk chatter cites positioning",
  "Technical watch: {SYM} tests key level at {LVL} — momentum traders circle",
  "{NAME} chief to speak at industry conference; watchers eye capex remarks",
  "Sector check: {SECTOR} names {DIR3} broadly, {SYM} among most active",
  "{SYM} short interest {DIR4} in latest exchange data",
  "Global desks: {NAME} liquidity thins into the close, spreads widen",
  "{NAME} announces expanded buyback authorization, sources say",
];

const WIRES = ["APX", "RTRS", "DJ", "BN", "MKTW"];

const NEWS = {
  items: [],
  rnd: mulberry32(hashSeed("newswire") ^ (Date.now() & 0xffffff)),

  seed(count = 34) {
    let t = Date.now();
    for (let i = 0; i < count; i++) {
      t -= (3 + this.rnd() * 22) * 60000;
      this.items.push(this.make(t));
    }
  },

  make(t) {
    const syms = MKT.order;
    const sym = syms[Math.floor(this.rnd() * syms.length)];
    const s = MKT.get(sym);
    const pct = MKT.chgPct(s);
    const tpl = NEWS_TEMPLATES[Math.floor(this.rnd() * NEWS_TEMPLATES.length)];
    const head = tpl
      .replace("{NAME}", s.meta.name)
      .replace(/\{SYM\}/g, sym)
      .replace("{PCT}", Math.abs(pct).toFixed(1))
      .replace("{DIR}", pct >= 0 ? "climbs" : "slides")
      .replace("{DIR2}", pct >= 0 ? "strong" : "mixed")
      .replace("{DIR3}", pct >= 0 ? "firmer" : "softer")
      .replace("{DIR4}", this.rnd() > 0.5 ? "rises" : "falls")
      .replace("{SIDE}", this.rnd() > 0.5 ? "call" : "put")
      .replace("{VOLX}", (1.2 + this.rnd() * 2.4).toFixed(1))
      .replace("{LVL}", fmtPx(s.meta, s.last * (1 + (this.rnd() - 0.5) * 0.02)))
      .replace("{SECTOR}", s.meta.sector);
    return { t, sym, head, wire: WIRES[Math.floor(this.rnd() * WIRES.length)], hot: this.rnd() > 0.82 };
  },

  spawn() {
    this.items.unshift(this.make(Date.now()));
    if (this.items.length > 60) this.items.pop();
  },

  forSym(sym) {
    const rel = this.items.filter(n => n.sym === sym);
    return rel.length ? rel : this.items.slice(0, 12);
  },
};

/* ---------- formatting helpers ---------- */

function fmtPx(meta, v) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: meta.dec,
    maximumFractionDigits: meta.dec,
  });
}

function fmtChg(meta, v) {
  const s = fmtPx(meta, Math.abs(v));
  return (v >= 0 ? "+" : "-") + s;
}

function fmtPct(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function fmtBig(v) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (abs >= 1e9)  return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6)  return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3)  return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

function fmtTime(t) {
  const d = new Date(t);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function fmtDate(t) {
  const d = new Date(t);
  return String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()] + " " + String(d.getFullYear() % 100).padStart(2, "0");
}

MKT.init();
NEWS.seed();
