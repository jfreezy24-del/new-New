/* ============================================================
   APEX TERMINAL — application layer
   Command line, views (GP/DES/N/MOST/WEI/HELP), watchlist,
   quote panel, news wire, ticker tape, live tick loop.
   ============================================================ */

"use strict";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const state = {
  sym: "AAPL",
  view: "GP",
  range: "1Y",
  type: "line",           // line | candle
  compare: [],            // up to 3 extra symbols
  watchlist: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "XOM", "SPX", "CCMP", "EURUSD", "GC1", "CL1", "BTC"],
};

const chart = new TerminalChart($("#chart"), $("#tooltip"));

/* ============================================================
   message line
   ============================================================ */

function msg(text, cls = "") {
  const el = $("#msgline");
  el.textContent = text;
  el.className = cls;
}

/* ============================================================
   command parser
   ============================================================ */

const VIEW_TITLES = {
  GP: "PRICE GRAPH", DES: "DESCRIPTION", N: "NEWS WIRE",
  MOST: "MOST ACTIVE MOVERS", WEI: "WORLD MARKETS", HELP: "HELP",
};

function runCommand(raw) {
  const input = raw.trim().toUpperCase().replace(/<GO>$/, "").replace(/\s+GO$/, "").trim();
  if (!input) return;
  const parts = input.split(/\s+/);
  const head = parts[0];

  // view functions
  if (VIEW_TITLES[head] && head !== "N" || ["N", "HELP"].includes(head)) {
    if (head === "MOST" || head === "WEI" || head === "HELP") { setView(head); return; }
    if (["GP", "DES", "N"].includes(head)) {
      // optional leading ticker: "GP MSFT" style not standard, but allow "MSFT GP"
      setView(head); return;
    }
  }

  if (head === "CLR") {
    state.compare = [];
    renderCompareLegend(); renderChart();
    msg("COMPARISON OVERLAYS CLEARED", "ok");
    return;
  }

  if (head === "COMP") {
    const sym = parts[1];
    if (!sym || !MKT.has(sym)) { msg(`COMP: UNKNOWN SECURITY "${sym || ""}" — TRY: COMP MSFT`, "err"); return; }
    if (sym === state.sym || state.compare.includes(sym)) { msg(`${sym} ALREADY ON THE GRAPH`, "info"); return; }
    if (state.compare.length >= 3) { msg("MAX 3 COMPARISON OVERLAYS — USE CLR TO RESET", "err"); return; }
    state.compare.push(sym);
    setView("GP");
    renderCompareLegend(); renderChart();
    msg(`ADDED ${sym} TO GRAPH — INDEXED % RETURN`, "ok");
    return;
  }

  if (head === "W") {
    const op = parts[1], sym = parts[2];
    if (op === "ADD" && sym && MKT.has(sym)) {
      if (!state.watchlist.includes(sym)) state.watchlist.push(sym);
      buildWatchlist(); msg(`${sym} ADDED TO WATCHLIST`, "ok");
    } else if (op === "DEL" && sym) {
      state.watchlist = state.watchlist.filter(s => s !== sym);
      buildWatchlist(); msg(`${sym} REMOVED FROM WATCHLIST`, "ok");
    } else {
      msg("USAGE: W ADD TICKER · W DEL TICKER", "err");
    }
    return;
  }

  // "TICKER" or "TICKER US EQUITY" or "TICKER DES/GP/N"
  const sym = head;
  if (MKT.has(sym)) {
    loadSecurity(sym);
    const fn = parts.find(p => ["DES", "GP", "N"].includes(p));
    if (fn) setView(fn);
    return;
  }

  msg(`UNKNOWN COMMAND "${input}" — PRESS F1 FOR HELP`, "err");
}

function loadSecurity(sym) {
  state.sym = sym;
  state.compare = state.compare.filter(s => s !== sym);
  const s = MKT.get(sym);
  msg(`LOADED ${sym} ${s.meta.country} ${s.meta.type.toUpperCase()} — ${s.meta.name}`, "ok");
  renderCompareLegend();
  renderAll();
}

/* ============================================================
   views
   ============================================================ */

function setView(v) {
  state.view = v;
  $$("#center-panel .view").forEach(el => el.classList.remove("active"));
  const target = { GP: "#view-gp", DES: "#view-des", N: "#view-news", MOST: "#view-most", WEI: "#view-wei", HELP: "#view-help" }[v];
  $(target).classList.add("active");
  $("#view-code").textContent = v;
  $("#view-title").textContent = VIEW_TITLES[v];
  $("#chart-controls").style.display = v === "GP" ? "flex" : "none";
  $$("#fkeys button").forEach(b => b.classList.toggle("active", b.dataset.fn === v));
  renderView();
  if (v === "GP") chart.resize();
}

function renderView() {
  switch (state.view) {
    case "GP":   renderChart(); break;
    case "DES":  renderDES(); break;
    case "N":    renderNews(); break;
    case "MOST": renderMost(); break;
    case "WEI":  renderWEI(); break;
  }
}

/* ---------- GP ---------- */

function renderChart() {
  const primary = MKT.series(state.sym, state.range);
  if (!primary) return;
  const meta = MKT.get(state.sym).meta;

  if (state.compare.length > 0) {
    // indexed % return from range start — common base, one axis
    const all = [state.sym, ...state.compare];
    const series = all.map((sym, i) => {
      const sr = MKT.series(sym, state.range);
      const base = sr.pts[0].v;
      return {
        sym,
        color: CHART_COLORS.series[i % CHART_COLORS.series.length],
        pts: sr.pts.map(p => ({ t: p.t, v: (p.v / base - 1) * 100 })),
        meta: MKT.get(sym).meta,
      };
    });
    chart.set({ mode: "compare", series, bars: null, showVolume: false, intraday: primary.intraday });
    return;
  }

  if (state.type === "candle" && primary.bars) {
    chart.set({
      mode: "candle",
      series: [{ sym: state.sym, color: CHART_COLORS.series[0], pts: primary.pts, meta }],
      bars: primary.bars,
      showVolume: true,
      intraday: false,
    });
  } else {
    chart.set({
      mode: "line",
      series: [{ sym: state.sym, color: CHART_COLORS.series[0], pts: primary.pts, meta }],
      bars: primary.bars,
      showVolume: !!primary.bars,
      intraday: primary.intraday,
    });
  }
}

function renderCompareLegend() {
  const el = $("#compare-legend");
  if (!state.compare.length) { el.innerHTML = ""; return; }
  const all = [state.sym, ...state.compare];
  el.innerHTML = all.map((sym, i) => {
    const col = CHART_COLORS.series[i % CHART_COLORS.series.length];
    const x = i === 0 ? "" : `<button data-rm="${sym}" title="Remove">✕</button>`;
    return `<span class="legend-chip"><span class="dot" style="background:${col}"></span>${sym}${x}</span>`;
  }).join("");
  el.querySelectorAll("button[data-rm]").forEach(b =>
    b.addEventListener("click", () => {
      state.compare = state.compare.filter(s => s !== b.dataset.rm);
      renderCompareLegend(); renderChart();
    }));
}

/* ---------- DES ---------- */

function renderDES() {
  const s = MKT.get(state.sym);
  const m = s.meta;
  const chg = MKT.chg(s), pct = MKT.chgPct(s);
  const cls = chg >= 0 ? "up" : "down";
  const pos52 = Math.max(0, Math.min(1, (s.last - s.lo52) / (s.hi52 - s.lo52 || 1)));

  const cells = [
    ["LAST PRICE", `<span class="${cls}">${fmtPx(m, s.last)}</span>`],
    ["CHANGE (1D)", `<span class="${cls}">${fmtChg(m, chg)} (${fmtPct(pct)})</span>`],
    ["OPEN", fmtPx(m, s.open)],
    ["DAY RANGE", `${fmtPx(m, s.dayLo)} – ${fmtPx(m, s.dayHi)}`],
    ["PREV CLOSE", fmtPx(m, s.prevClose)],
    ["VOLUME", fmtBig(s.vol)],
    ["52WK HIGH", fmtPx(m, s.hi52)],
    ["52WK LOW", fmtPx(m, s.lo52)],
  ];
  if (m.cap) cells.push(["MARKET CAP", "$" + fmtBig(m.cap)]);
  if (m.pe)  cells.push(["P/E RATIO", m.pe.toFixed(1) + "x"]);
  if (m.dy != null && m.type === "Equity") cells.push(["DVD YIELD", m.dy.toFixed(2) + "%"]);
  if (m.emp) cells.push(["EMPLOYEES", m.emp]);
  cells.push(["EXCHANGE", m.exch || "—"], ["SECTOR", m.sector], ["COUNTRY", m.country], ["TYPE", m.type]);

  $("#view-des").innerHTML = `
    <div class="des-head">
      <span class="des-sym">${state.sym}</span>
      <span class="des-name">${m.name}</span>
      <span class="des-meta">${m.exch || ""} · ${m.country} ${m.type.toUpperCase()}</span>
    </div>
    <p class="des-desc">${m.desc}</p>
    <div class="des-grid">
      ${cells.map(([k, v]) => `<div class="des-cell"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}
    </div>
    <div class="range-bar-wrap">
      <div class="range-bar-label"><span>52WK LOW ${fmtPx(m, s.lo52)}</span><span>52WK HIGH ${fmtPx(m, s.hi52)}</span></div>
      <div class="range-bar"><div class="marker" style="left:${(pos52 * 100).toFixed(1)}%"></div></div>
    </div>`;
}

/* ---------- news ---------- */

function newsRow(n, compact = false) {
  const symCell = compact ? "" : `<span class="news-sym">${n.sym}</span>`;
  return `<div class="news-row${n.hot ? " hot" : ""}" data-sym="${n.sym}">
    <span class="news-time">${fmtTime(n.t)}</span>${symCell}
    <span class="news-head">${n.wire}: ${n.head}</span>
  </div>`;
}

function renderNews() {
  const items = NEWS.forSym(state.sym);
  const own = NEWS.items.some(n => n.sym === state.sym);
  const label = own ? `STORIES ON ${state.sym}` : `NO ${state.sym} STORIES — SHOWING TOP WIRE`;
  $("#view-news").innerHTML =
    `<div class="wei-section">${label}</div>` + items.map(n => newsRow(n)).join("");
  bindNewsClicks($("#view-news"));
}

function renderHeadlines() {
  $("#headline-body").innerHTML = NEWS.items.slice(0, 14).map(n => newsRow(n, true)).join("");
  bindNewsClicks($("#headline-body"));
}

function bindNewsClicks(root) {
  root.querySelectorAll(".news-row").forEach(r =>
    r.addEventListener("click", () => { loadSecurity(r.dataset.sym); setView("N"); }));
}

/* ---------- MOST ---------- */

function tableRow(s) {
  const m = s.meta;
  const pct = MKT.chgPct(s), chg = MKT.chg(s);
  const cls = chg >= 0 ? "up" : "down";
  const arrow = chg >= 0 ? "▲" : "▼";
  return `<tr data-sym="${m.sym}">
    <td>${m.sym}</td><td>${m.name}</td>
    <td>${fmtPx(m, s.last)}</td>
    <td class="${cls}">${arrow} ${fmtChg(m, chg)}</td>
    <td class="${cls}">${fmtPct(pct)}</td>
    <td>${fmtBig(s.vol)}</td>
  </tr>`;
}

function bindTableClicks(root) {
  root.querySelectorAll("tr[data-sym]").forEach(r =>
    r.addEventListener("click", () => { loadSecurity(r.dataset.sym); setView("GP"); }));
}

function renderMost() {
  const rows = MKT.movers().map(tableRow).join("");
  $("#view-most").innerHTML = `
    <table class="data-table">
      <thead><tr><th>TICKER</th><th>NAME</th><th>LAST</th><th>CHG</th><th>CHG%</th><th>VOLUME</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  bindTableClicks($("#view-most"));
}

/* ---------- WEI ---------- */

function renderWEI() {
  const section = (label, type) => {
    const rows = MKT.byType(type).map(tableRow).join("");
    return `<div class="wei-section">${label}</div>
      <table class="data-table">
        <thead><tr><th>TICKER</th><th>NAME</th><th>LAST</th><th>CHG</th><th>CHG%</th><th>VOLUME</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };
  $("#view-wei").innerHTML =
    section("EQUITY INDICES", "Index") +
    section("CURRENCIES", "Curncy") +
    section("COMMODITIES", "Comdty") +
    section("DIGITAL ASSETS", "Crypto");
  bindTableClicks($("#view-wei"));
}

/* ============================================================
   watchlist
   ============================================================ */

const wlEls = new Map(); // sym -> {row, last, chg, spark}

function buildWatchlist() {
  const body = $("#watch-body");
  body.innerHTML = "";
  wlEls.clear();
  for (const sym of state.watchlist) {
    const s = MKT.get(sym);
    if (!s) continue;
    const row = document.createElement("div");
    row.className = "wl-row";
    row.dataset.sym = sym;
    row.innerHTML = `
      <div><div class="wl-sym">${sym}</div><div class="wl-name">${s.meta.name}</div></div>
      <div class="wl-last"></div>
      <div class="wl-chg"></div>
      <canvas width="64" height="18"></canvas>`;
    row.addEventListener("click", () => loadSecurity(sym));
    body.appendChild(row);
    wlEls.set(sym, {
      row,
      last: row.querySelector(".wl-last"),
      chg: row.querySelector(".wl-chg"),
      spark: row.querySelector("canvas"),
    });
  }
  updateWatchlist(true);
}

function updateWatchlist(full = false) {
  for (const [sym, els] of wlEls) {
    const s = MKT.get(sym);
    const pct = MKT.chgPct(s);
    const cls = pct >= 0 ? "up" : "down";
    els.row.classList.toggle("selected", sym === state.sym);
    els.last.textContent = fmtPx(s.meta, s.last);
    els.last.className = "wl-last " + cls;
    els.chg.textContent = fmtPct(pct);
    els.chg.className = "wl-chg " + cls;
    if (s.dir !== 0 && !full) {
      const fc = s.dir > 0 ? "flash-up" : "flash-down";
      els.row.classList.remove("flash-up", "flash-down");
      void els.row.offsetWidth; // restart animation
      els.row.classList.add(fc);
    }
    if (full) {
      const closes = s.daily.slice(-30).map(b => b.c);
      closes.push(s.last);
      drawSparkline(els.spark, closes, pct >= 0);
    }
  }
}

/* ============================================================
   quote panel
   ============================================================ */

function renderQuote() {
  const s = MKT.get(state.sym);
  const m = s.meta;
  const chg = MKT.chg(s), pct = MKT.chgPct(s);
  const cls = chg >= 0 ? "up" : "down";
  const arrow = chg >= 0 ? "▲" : "▼";
  const rows = [
    ["OPEN", fmtPx(m, s.open)],
    ["HIGH", fmtPx(m, s.dayHi)],
    ["LOW", fmtPx(m, s.dayLo)],
    ["PREV CLOSE", fmtPx(m, s.prevClose)],
    ["VOLUME", fmtBig(s.vol)],
    ["52WK RANGE", `${fmtPx(m, s.lo52)} – ${fmtPx(m, s.hi52)}`],
  ];
  $("#quote-body").innerHTML = `
    <div class="q-sym">${state.sym} <span style="color:var(--muted);font-size:11px;font-weight:400">${m.country} ${m.type.toUpperCase()}</span></div>
    <div class="q-name">${m.name}</div>
    <div class="q-last ${cls}">${fmtPx(m, s.last)}</div>
    <div class="q-chg ${cls}">${arrow} ${fmtChg(m, chg)} (${fmtPct(pct)})</div>
    <div class="q-rows">
      ${rows.map(([k, v]) => `<div class="q-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}
    </div>`;
}

/* ============================================================
   ticker tape
   ============================================================ */

const TAPE_SYMS = ["SPX", "INDU", "CCMP", "RTY", "DAX", "UKX", "NKY", "HSI", "EURUSD", "USDJPY", "GBPUSD", "DXY", "CL1", "GC1", "NG1", "BTC", "ETH"];

function tapeHTML() {
  return TAPE_SYMS.map(sym => {
    const s = MKT.get(sym);
    const pct = MKT.chgPct(s);
    const cls = pct >= 0 ? "up" : "down";
    const arrow = pct >= 0 ? "▲" : "▼";
    return `<span class="tape-item"><span class="t-sym">${sym}</span><span class="t-px">${fmtPx(s.meta, s.last)}</span><span class="${cls}">${arrow} ${fmtPct(pct)}</span></span>`;
  }).join("");
}

function updateTape() {
  // duplicated content so the 50% translate loops seamlessly
  $("#tape-track").innerHTML = tapeHTML() + tapeHTML();
}

/* ============================================================
   render orchestration + live loop
   ============================================================ */

function renderAll() {
  renderView();
  renderQuote();
  updateWatchlist(true);
}

let tickCount = 0;

function liveTick() {
  MKT.tick();
  tickCount++;
  updateWatchlist(false);
  renderQuote();
  if (state.view === "GP") renderChart();
  if (tickCount % 4 === 0) updateTape();
  if (tickCount % 8 === 0) updateWatchlist(true);   // refresh sparklines
  if (tickCount % 13 === 0) {
    NEWS.spawn();
    renderHeadlines();
    if (state.view === "N") renderNews();
  }
  if (state.view === "MOST" && tickCount % 3 === 0) renderMost();
  if (state.view === "WEI" && tickCount % 3 === 0) renderWEI();
}

/* ============================================================
   input wiring
   ============================================================ */

function wire() {
  const cmd = $("#cmd");

  cmd.addEventListener("keydown", e => {
    if (e.key === "Enter") { runCommand(cmd.value); cmd.value = ""; }
    if (e.key === "Escape") cmd.value = "";
  });
  $("#go-btn").addEventListener("click", () => { runCommand(cmd.value); cmd.value = ""; cmd.focus(); });

  $$("#fkeys button").forEach(b => b.addEventListener("click", () => setView(b.dataset.fn)));

  document.addEventListener("keydown", e => {
    const fnMap = { F1: "HELP", F2: "DES", F3: "GP", F4: "N", F5: "MOST", F6: "WEI" };
    if (fnMap[e.key]) { e.preventDefault(); setView(fnMap[e.key]); return; }
    // any printable key focuses the command line, terminal-style
    if (document.activeElement !== cmd && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      cmd.focus();
    }
  });

  $$("#range-group button").forEach(b => b.addEventListener("click", () => {
    state.range = b.dataset.range;
    $$("#range-group button").forEach(x => x.classList.toggle("active", x === b));
    // candles need daily bars — force line on 1D
    const cndl = $('#type-group button[data-type="candle"]');
    if (state.range === "1D") {
      cndl.disabled = true;
      if (state.type === "candle") setChartType("line");
    } else {
      cndl.disabled = false;
    }
    renderChart();
  }));

  $$("#type-group button").forEach(b => b.addEventListener("click", () => {
    if (b.disabled) return;
    setChartType(b.dataset.type);
  }));

  function setChartType(t) {
    state.type = t;
    $$("#type-group button").forEach(x => x.classList.toggle("active", x.dataset.type === t));
    renderChart();
  }
}

/* ============================================================
   clock + boot
   ============================================================ */

function tickClock() {
  const d = new Date();
  $("#clock").textContent =
    [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
}

function boot() {
  wire();
  buildWatchlist();
  renderHeadlines();
  updateTape();
  setView("GP");
  loadSecurity("AAPL");
  msg("READY — TYPE A TICKER AND PRESS ENTER, OR F1 FOR HELP", "info");
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(liveTick, 1500);
  $("#cmd").focus();
}

boot();
