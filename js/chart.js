/* ============================================================
   APEX TERMINAL — canvas chart renderer
   Line/area, candlesticks, indexed-% compare overlays,
   volume pane, crosshair + tooltip. One y-axis, always.
   ============================================================ */

"use strict";

const CHART_COLORS = {
  series: ["#c98500", "#2f9fbc", "#9085e9", "#e66767"], // validated on #0a0a0a
  grid:   "#22221f",
  axis:   "#383835",
  label:  "#898781",
  text:   "#e8e6e0",
  up:     "#2ec25a",
  down:   "#ff5f5f",
  volUp:  "rgba(46, 194, 90, 0.35)",
  volDn:  "rgba(255, 95, 95, 0.35)",
  cross:  "#5a5a50",
  surface:"#0a0a0a",
};

class TerminalChart {
  constructor(canvas, tooltip) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.tt = tooltip;
    this.cfg = null;      // {mode, series:[{sym,color,pts,meta}], bars, showVolume}
    this.hover = null;    // hovered index
    this.pad = { l: 10, r: 74, t: 14, b: 24 };

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement);

    canvas.addEventListener("mousemove", e => this.onMove(e));
    canvas.addEventListener("mouseleave", () => { this.hover = null; this.tt.style.display = "none"; this.draw(); });
  }

  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(50, r.width);
    this.h = Math.max(50, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  set(cfg) { this.cfg = cfg; this.draw(); }

  /* ---------- geometry ---------- */

  layout() {
    const volH = this.cfg && this.cfg.showVolume ? Math.round((this.h - this.pad.t - this.pad.b) * 0.16) : 0;
    const px = { x: this.pad.l, w: this.w - this.pad.l - this.pad.r };
    const price = { y: this.pad.t, h: this.h - this.pad.t - this.pad.b - volH - (volH ? 6 : 0) };
    const vol = volH ? { y: price.y + price.h + 6, h: volH } : null;
    return { px, price, vol };
  }

  domain() {
    const c = this.cfg;
    let lo = Infinity, hi = -Infinity;
    if (c.mode === "candle" && c.bars) {
      for (const b of c.bars) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }
    } else {
      for (const s of c.series) for (const p of s.pts) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const padv = (hi - lo) * 0.06 || Math.abs(hi) * 0.01 || 1;
    return [lo - padv, hi + padv];
  }

  n() {
    const c = this.cfg;
    return c.mode === "candle" && c.bars ? c.bars.length : (c.series[0] ? c.series[0].pts.length : 0);
  }

  xAt(i, px) { const n = this.n(); return n <= 1 ? px.x + px.w / 2 : px.x + (i / (n - 1)) * px.w; }
  yAt(v, area, dom) { return area.y + area.h - ((v - dom[0]) / (dom[1] - dom[0])) * area.h; }

  ticks(dom, count = 5) {
    const span = dom[1] - dom[0];
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count + 1) || mag * 10;
    const out = [];
    for (let v = Math.ceil(dom[0] / step) * step; v <= dom[1]; v += step) out.push(v);
    return out;
  }

  /* ---------- draw ---------- */

  draw() {
    const ctx = this.ctx;
    if (!this.w) return;
    ctx.clearRect(0, 0, this.w, this.h);
    const c = this.cfg;
    if (!c || !this.n()) return;

    const { px, price, vol } = this.layout();
    const dom = this.domain();
    const K = CHART_COLORS;

    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";

    // horizontal gridlines + right-side y labels
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const tv of this.ticks(dom)) {
      const y = Math.round(this.yAt(tv, price, dom)) + 0.5;
      ctx.strokeStyle = K.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px.x, y); ctx.lineTo(px.x + px.w, y); ctx.stroke();
      ctx.fillStyle = K.label;
      ctx.fillText(this.fmtTick(tv), px.x + px.w + 8, y);
    }

    // x labels
    const labels = this.xLabels();
    ctx.fillStyle = K.label; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const { i, txt } of labels) ctx.fillText(txt, this.xAt(i, px), this.h - this.pad.b + 8);

    // volume pane
    if (vol && c.bars) this.drawVolume(c.bars, px, vol);

    // marks
    if (c.mode === "candle" && c.bars) this.drawCandles(c.bars, px, price, dom);
    else this.drawLines(c.series, px, price, dom);

    // last-value tag on the right axis (single-series modes only —
    // in compare mode the direct labels own that gutter)
    if (c.mode !== "compare") this.drawLastTag(px, price, dom);

    // crosshair overlay
    if (this.hover != null) this.drawCrosshair(px, price, dom);
  }

  fmtTick(v) {
    const c = this.cfg;
    if (c.mode === "compare") return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
    const dec = c.series[0] && c.series[0].meta ? Math.min(c.series[0].meta.dec, 2) : 2;
    return v >= 10000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec);
  }

  xLabels() {
    const c = this.cfg;
    const n = this.n();
    const ts = c.mode === "candle" && c.bars ? c.bars.map(b => b.t) : c.series[0].pts.map(p => p.t);
    const count = Math.max(2, Math.min(7, Math.floor(this.w / 130)));
    const out = [];
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1)) * (n - 1));
      out.push({ i, txt: c.intraday ? fmtTime(ts[i]) : fmtDate(ts[i]) });
    }
    return out;
  }

  drawLines(series, px, price, dom) {
    const ctx = this.ctx;
    series.forEach((s, si) => {
      const pts = s.pts;
      // gradient area fill under the primary series only
      if (si === 0 && series.length === 1) {
        const g = ctx.createLinearGradient(0, price.y, 0, price.y + price.h);
        g.addColorStop(0, s.color + "3d");
        g.addColorStop(1, s.color + "00");
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = this.xAt(i, px), y = this.yAt(p.v, price, dom);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.lineTo(this.xAt(pts.length - 1, px), price.y + price.h);
        ctx.lineTo(this.xAt(0, px), price.y + price.h);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = this.xAt(i, px), y = this.yAt(p.v, price, dom);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
    });

    // direct labels at line ends when comparing (identity never by color alone)
    if (series.length > 1) {
      ctx.font = "bold 10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const used = [];
      for (const s of series) {
        const last = s.pts[s.pts.length - 1];
        let y = this.yAt(last.v, price, dom);
        while (used.some(u => Math.abs(u - y) < 11)) y += 11; // avoid collisions
        used.push(y);
        ctx.fillStyle = s.color;
        ctx.fillText(s.sym, px.x + px.w + 8, y);
      }
    }
  }

  drawCandles(bars, px, price, dom) {
    const ctx = this.ctx;
    const n = bars.length;
    const slot = px.w / n;
    const bw = Math.max(2, Math.min(9, Math.floor(slot * 0.65)));
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const x = Math.round(this.xAt(i, px));
      const up = b.c >= b.o;
      const col = up ? CHART_COLORS.up : CHART_COLORS.down;
      const yO = this.yAt(b.o, price, dom), yC = this.yAt(b.c, price, dom);
      const yH = this.yAt(b.h, price, dom), yL = this.yAt(b.l, price, dom);
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, yH); ctx.lineTo(x + 0.5, yL); ctx.stroke();
      const top = Math.min(yO, yC);
      const hgt = Math.max(1, Math.abs(yC - yO));
      if (up) { // hollow body for up candles
        ctx.strokeStyle = col;
        ctx.fillStyle = CHART_COLORS.surface;
        ctx.fillRect(x - bw / 2, top, bw, hgt);
        ctx.strokeRect(x - bw / 2 + 0.5, top + 0.5, bw - 1, Math.max(1, hgt - 1));
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(x - bw / 2, top, bw, hgt);
      }
    }
  }

  drawVolume(bars, px, vol) {
    const ctx = this.ctx;
    const maxV = Math.max(...bars.map(b => b.v)) || 1;
    const n = bars.length;
    const slot = px.w / n;
    const bw = Math.max(1, Math.min(7, Math.floor(slot * 0.6)));
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const x = Math.round(this.xAt(i, px));
      const h = Math.max(1, (b.v / maxV) * vol.h);
      ctx.fillStyle = b.c >= b.o ? CHART_COLORS.volUp : CHART_COLORS.volDn;
      ctx.fillRect(x - bw / 2, vol.y + vol.h - h, bw, h);
    }
    ctx.strokeStyle = CHART_COLORS.axis; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px.x, vol.y - 3.5); ctx.lineTo(px.x + px.w, vol.y - 3.5);
    ctx.stroke();
    ctx.fillStyle = CHART_COLORS.label;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("VOL " + fmtBig(bars[bars.length - 1].v), px.x + px.w + 8, vol.y + vol.h / 2);
  }

  drawLastTag(px, price, dom) {
    const c = this.cfg;
    const ctx = this.ctx;
    let v, col, txt;
    if (c.mode === "candle" && c.bars) {
      const b = c.bars[c.bars.length - 1];
      v = b.c; col = b.c >= b.o ? CHART_COLORS.up : CHART_COLORS.down;
      txt = this.fmtTick(v);
    } else {
      const s = c.series[0];
      v = s.pts[s.pts.length - 1].v;
      col = s.color;
      txt = this.fmtTick(v);
    }
    const y = Math.max(price.y + 7, Math.min(price.y + price.h - 7, this.yAt(v, price, dom)));
    ctx.font = "bold 10px ui-monospace, Menlo, Consolas, monospace";
    const w = ctx.measureText(txt).width + 10;
    ctx.fillStyle = col;
    ctx.fillRect(px.x + px.w + 3, y - 8, w, 16);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(txt, px.x + px.w + 8, y + 0.5);
  }

  /* ---------- crosshair + tooltip ---------- */

  onMove(e) {
    if (!this.cfg || !this.n()) return;
    const r = this.cv.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const { px } = this.layout();
    const n = this.n();
    const i = Math.round(((mx - px.x) / px.w) * (n - 1));
    this.hover = Math.max(0, Math.min(n - 1, i));
    this.draw();
    this.showTooltip(e.clientX - r.left, e.clientY - r.top);
  }

  drawCrosshair(px, price, dom) {
    const ctx = this.ctx;
    const c = this.cfg;
    const i = this.hover;
    const x = Math.round(this.xAt(i, px)) + 0.5;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = CHART_COLORS.cross;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, price.y); ctx.lineTo(x, price.y + price.h); ctx.stroke();
    ctx.setLineDash([]);
    // markers on each series
    if (c.mode !== "candle") {
      for (const s of c.series) {
        const p = s.pts[i]; if (!p) continue;
        const y = this.yAt(p.v, price, dom);
        ctx.beginPath(); ctx.arc(this.xAt(i, px), y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.fill();
        ctx.strokeStyle = CHART_COLORS.surface; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
  }

  showTooltip(mx, my) {
    const c = this.cfg;
    const i = this.hover;
    const tt = this.tt;
    let html = "";
    if (c.mode === "candle" && c.bars) {
      const b = c.bars[i];
      html = `<div class="tt-date">${fmtDate(b.t)}</div>` +
        `<div><span class="tt-k">OPEN</span>${this.fmtTick(b.o)}</div>` +
        `<div><span class="tt-k">HIGH</span>${this.fmtTick(b.h)}</div>` +
        `<div><span class="tt-k">LOW</span>${this.fmtTick(b.l)}</div>` +
        `<div><span class="tt-k">CLSE</span>${this.fmtTick(b.c)}</div>` +
        `<div><span class="tt-k">VOL</span>${fmtBig(b.v)}</div>`;
    } else {
      const t = c.series[0].pts[i] ? c.series[0].pts[i].t : Date.now();
      html = `<div class="tt-date">${c.intraday ? fmtTime(t) : fmtDate(t)}</div>`;
      for (const s of c.series) {
        const p = s.pts[i]; if (!p) continue;
        const val = c.mode === "compare"
          ? (p.v >= 0 ? "+" : "") + p.v.toFixed(2) + "%"
          : this.fmtTick(p.v);
        html += `<div><span class="tt-k" style="color:${s.color}">${s.sym}</span>${val}</div>`;
      }
    }
    tt.innerHTML = html;
    tt.style.display = "block";
    const tw = tt.offsetWidth, th = tt.offsetHeight;
    let x = mx + 16, y = my + 14;
    if (x + tw > this.w - 4) x = mx - tw - 12;
    if (y + th > this.h - 4) y = my - th - 10;
    tt.style.left = x + "px";
    tt.style.top = y + "px";
  }
}

/* ---------- watchlist sparkline ---------- */

function drawSparkline(canvas, values, positive) {
  const dpr = window.devicePixelRatio || 1;
  const w = 64, h = 18;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - lo) / span) * (h - 4);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = positive ? CHART_COLORS.up : CHART_COLORS.down;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}
