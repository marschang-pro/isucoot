// 圓盤系統® 數量估算（實固施工架 Ø48.6／重型支撐架 Ø60.2）
// 全部在瀏覽器裡計算，不連任何資料庫。
//
// 規格來源：實固股份有限公司官網公開型錄
//   ・「圓盤系統®」施工架（2026）：主架 Ø48.6×2.5，長 0.5/1.0/1.5/2.0/3.0m，圓盤間距 500mm；
//     橫桿 Ø42.7×2.3，0.9/1.2/1.5/1.8m（特殊 0.762/1.219/1.829m）；
//     斜桿 1.2×2.0、1.5×2.0、1.8×2.0m；調整座 600mm（可調 80～500mm）；
//     腳踏板 550mm 寬、蓋板 265mm 寬，長 1200/1500/1800mm。
//   ・「圓盤系統®」重型支撐架（2025）：主架 Ø60.2×3.2，長 1.0/1.5/2.0/3.0m，圓盤間距 500mm；
//     標準基座 200mm；輔助桿 0.25/0.5m；上下調整座伸縮 80～450mm；
//     橫桿 0.6/0.9/1.2/1.5/1.8/2.4m；斜桿（寬×高）0.6/0.9/1.2/1.8×1.0m、0.6/0.9/1.2/1.5/1.8/2.4×1.5m；
//     定位桿 1.5×1.2、1.5×1.5、1.8×1.2、1.8×1.5、1.8×1.8、2.4×1.5m。
// 數量為估算，不是原廠設計。
(function () {
  "use strict";

  const STORAGE_KEY = "sucoot-qty-inputs-v1";
  const EPS = 1e-9;
  const $ = (id) => document.getElementById(id);
  const ceil = (x) => Math.ceil(x - EPS);
  const floor = (x) => Math.floor(x + EPS);
  const fmt = (n, d) => Number(n).toLocaleString("zh-TW", { maximumFractionDigits: d == null ? 0 : d });
  const m = (x) => (Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? x.toFixed(1) : String(+x.toFixed(3))) + "m";

  // ---- 型錄規格 ----
  const SC = {
    lift: 2.0,
    stdLengths: [3.0, 2.0, 1.5, 1.0, 0.5],
    boardLengths: [1.2, 1.5, 1.8],
    diagSpans: [1.2, 1.5, 1.8],
    // 依型錄「腳踏板與蓋板」滿鋪圖示推估：架寬 → [550 腳踏板片數, 265 蓋板片數]
    deckByWidth: { "0.762": [1, 0], "0.9": [1, 1], "1.2": [2, 0], "1.219": [2, 0], "1.5": [2, 1], "1.8": [3, 0], "1.829": [3, 0] },
  };
  const SH = {
    base: 0.2,
    adjMin: 0.08, adjMax: 0.45,
    mains: [3.0, 2.0, 1.5, 1.0],
    aux: [0.5, 0.25],
    diag: { "1.0": [0.6, 0.9, 1.2, 1.8], "1.5": [0.6, 0.9, 1.2, 1.5, 1.8, 2.4] },
    pos: [[1.5, 1.2], [1.5, 1.5], [1.8, 1.2], [1.8, 1.5], [1.8, 1.8], [2.4, 1.5]],
  };

  // ---- 數字轉換：接受全形數字、逗號小數點、單位文字 ----
  function toNumber(raw) {
    let s = String(raw || "")
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[．。]/g, ".").replace(/[，,]/g, ".").replace(/[－—]/g, "-")
      .replace(/\s+/g, "")
      .replace(/(公尺|米|m|M|%|％|層|片|支|跨)$/u, "");
    if (s === "" || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }
  const val = (id) => $(id).value.trim();
  const num = (id) => (val(id) === "" ? NaN : toNumber(val(id)));
  const radio = (name) => document.querySelector('input[name="' + name + '"]:checked').value;
  const same = (a, b) => Math.abs(a - b) < 1e-6;
  const inList = (x, list) => list.some((y) => same(x, y));

  // ---- 輸入檢查 ----
  const touched = {};
  function check(rules) {
    const errors = [];
    let blank = false;
    rules.forEach(function (r) {
      const el = $(r.id);
      const v = num(r.id);
      const empty = val(r.id) === "";
      let msg = "";
      if (empty) msg = "請填寫「" + r.label + "」";
      else if (Number.isNaN(v)) msg = "「" + r.label + "」請輸入數字";
      else if (v < r.min || v > r.max) msg = "「" + r.label + "」要介於 " + r.min + "～" + r.max;
      else if (r.int && !Number.isInteger(v)) msg = "「" + r.label + "」要填整數";
      const quiet = empty && r.req && !touched[r.id];
      if (quiet) blank = true;
      el.classList.toggle("invalid", !!msg && !quiet);
      if (msg) errors.push({ msg: msg, quiet: quiet });
    });
    return { errors: errors, blank: blank };
  }

  // 把高度拆成主架：主要長度盡量多，剩下的用最短可用主架補（往上取整）
  function splitStandards(total, mainLen, lengths) {
    const pieces = {};
    const k = floor(total / mainLen);
    if (k > 0) pieces[mainLen] = k;
    let r = total - k * mainLen;
    if (r > 0.001) {
      const asc = lengths.slice().sort((a, b) => a - b);
      const pick = asc.find((l) => l >= r - 1e-6) || asc[asc.length - 1];
      pieces[pick] = (pieces[pick] || 0) + 1;
    }
    return pieces;
  }

  // =============== 施工架 ===============
  function calcScaffold() {
    const deckAll = $("sc-deck-all").checked;
    const tieOn = $("sc-tie-on").checked;
    const rules = [
      { id: "sc-length", label: "外牆總長", min: 0.5, max: 10000, req: true },
      { id: "sc-height", label: "搭設高度", min: 0.5, max: 100, req: true },
      { id: "sc-board", label: "每跨每層腳踏板", min: 0, max: 6, int: true },
      { id: "sc-cover", label: "每跨每層蓋板", min: 0, max: 6, int: true },
      { id: "sc-diag", label: "斜桿每幾跨裝 1 支", min: 0, max: 50, int: true },
      { id: "sc-rail", label: "護欄橫桿支數", min: 0, max: 4, int: true },
      { id: "sc-spare", label: "備品／損耗率", min: 0, max: 100 },
    ];
    if (!deckAll) rules.push({ id: "sc-deck-levels", label: "鋪踏板的層數", min: 0, max: 100, int: true });
    if (tieOn) rules.push({ id: "sc-tieH", label: "壁連水平間距", min: 0.5, max: 30 }, { id: "sc-tieV", label: "壁連垂直間距", min: 0.5, max: 30 });
    const c = check(rules);
    if (c.errors.length) return c;

    const L = num("sc-length"), H = num("sc-height");
    const closed = radio("sc-layout") === "closed";
    const span = Number($("sc-span").value), width = Number($("sc-width").value);
    const stdLen = Number($("sc-std").value);
    const guard = $("sc-guard").checked;
    const spare = num("sc-spare");
    const kk = 1 + spare / 100;
    const q = (n) => ceil(n * kk);

    const levels = ceil(H / SC.lift);
    const spans = ceil(L / span);
    const cols = closed ? spans : spans + 1;
    const lines = 2; // 內、外兩排立柱
    const posts = cols * lines;
    const nodes = levels + 1; // 底層＋每層頂的橫桿層
    const deckLevels = deckAll ? levels : Math.min(num("sc-deck-levels"), levels);
    const stdHeight = levels * SC.lift + (guard ? 1.0 : 0);
    const pieces = splitStandards(stdHeight, stdLen, SC.stdLengths);
    const piecesPerPost = Object.values(pieces).reduce((a, b) => a + b, 0);
    const diagEvery = num("sc-diag");
    const diagPerLevel = diagEvery > 0 ? ceil(spans / diagEvery) : 0;
    const rails = num("sc-rail");
    const nBoard = num("sc-board"), nCover = num("sc-cover");

    const items = [];
    const warns = [];
    items.push({ name: "調整座", spec: "600mm（可調 80～500mm）", qty: q(posts), unit: "支", how: "立柱 " + posts + " 支（" + cols + " 列 × 內外 2 排）" });
    Object.keys(pieces).map(Number).sort((a, b) => b - a).forEach(function (len) {
      items.push({ name: "主架", spec: "Ø48.6 × " + m(len), qty: q(pieces[len] * posts), unit: "支", how: "每支立柱 " + pieces[len] + " 支 × " + posts });
    });
    items.push({ name: "主架插銷", spec: "上下主架接合用", qty: q((piecesPerPost - 1) * posts), unit: "支", how: "每支立柱接頭 " + (piecesPerPost - 1) + " 處 × " + posts });

    const runLedgers = spans * lines * nodes;
    const railLedgers = spans * rails * deckLevels;
    if (same(span, width)) {
      items.push({ name: "橫桿", spec: m(span) + "（沿牆＋進深）", qty: q(runLedgers + railLedgers + cols * nodes), unit: "支",
        how: "沿牆 " + spans + "跨×2排×" + nodes + "層＋護欄 " + railLedgers + "＋進深 " + cols + "列×" + nodes + "層" });
    } else {
      items.push({ name: "橫桿（沿牆）", spec: m(span), qty: q(runLedgers + railLedgers), unit: "支",
        how: spans + " 跨 × 2 排 × " + nodes + " 層，加外側護欄 " + spans + "×" + rails + "×" + deckLevels + " 層" });
      items.push({ name: "橫桿（進深）", spec: m(width), qty: q(cols * nodes), unit: "支", how: cols + " 列 × " + nodes + " 層" });
    }

    if (diagPerLevel > 0) {
      const d = inList(span, SC.diagSpans) ? m(span) + " × 2.0m" : "（型錄無 " + m(span) + " 用斜桿）";
      if (!inList(span, SC.diagSpans)) warns.push("型錄斜桿只有 1.2／1.5／1.8 × 2.0m，跨距 " + m(span) + " 的斜桿需訂製。");
      items.push({ name: "斜桿", spec: d, qty: q(diagPerLevel * levels), unit: "支", how: "每層 " + diagPerLevel + " 支（" + spans + " 跨每 " + diagEvery + " 跨 1 支）× " + levels + " 層" });
    }

    if (deckLevels > 0 && (nBoard > 0 || nCover > 0)) {
      const okLen = inList(span, SC.boardLengths) || same(span, 1.829) || same(span, 1.219);
      if (!okLen) warns.push("型錄腳踏板／蓋板長度只有 1.2／1.5／1.8m，跨距 " + m(span) + " 沒有對應踏板。");
      const bl = same(span, 1.829) ? 1.8 : same(span, 1.219) ? 1.2 : span;
      if (same(span, 1.829) || same(span, 1.219)) warns.push("跨距 " + m(span) + " 的踏板長度以 " + m(bl) + " 計，是否共用請向實固確認。");
      if (nBoard > 0) items.push({ name: "腳踏板", spec: "550 × " + fmt(bl * 1000) + "mm", qty: q(spans * deckLevels * nBoard), unit: "片", how: spans + " 跨 × " + deckLevels + " 層 × " + nBoard + " 片" });
      if (nCover > 0) items.push({ name: "蓋板", spec: "265 × " + fmt(bl * 1000) + "mm", qty: q(spans * deckLevels * nCover), unit: "片", how: spans + " 跨 × " + deckLevels + " 層 × " + nCover + " 片" });
    }

    if (tieOn) {
      const tH = num("sc-tieH"), tV = num("sc-tieV");
      const tc = ceil(L / tH) + (closed ? 0 : 1), tr = ceil(H / tV);
      items.push({ name: "壁連", spec: "非型錄品項，請依設計", qty: q(tc * tr), unit: "處", how: "水平 " + tc + " 點 × 垂直 " + tr + " 點" });
    }

    return {
      summary: [["層數", levels + " 層"], ["跨數", spans + " 跨"], ["立柱", posts + " 支"], ["立面面積", fmt(L * H, 2) + " m²"]],
      items: items, warns: warns,
      note: "層高 2.0m，最上層踏板高約 " + fmt(levels * SC.lift, 2) + "m；每支立柱主架總長 " + fmt(stdHeight, 2) + "m" + (guard ? "（含頂層護欄 1.0m）" : "") +
        "。最下面一支可用平主架（不含連接棒）。" + (spare > 0 ? " 數量已含備品 " + fmt(spare, 2) + "%。" : ""),
      text: "外牆總長 " + fmt(L, 2) + "m、搭設高度 " + fmt(H, 2) + "m（" + (closed ? "環繞一圈" : "單面") + "），跨距 " + m(span) + "、架寬 " + m(width),
      title: "【圓盤系統® 施工架 Ø48.6】",
    };
  }

  // =============== 重型支撐架 ===============
  function calcShoring() {
    const rules = [
      { id: "sh-a", label: "長度", min: 0.5, max: 1000, req: true },
      { id: "sh-b", label: "寬度", min: 0.5, max: 1000, req: true },
      { id: "sh-h", label: "支撐高度", min: 1.4, max: 40, req: true },
      { id: "sh-pos-every", label: "定位桿每幾層裝一次", min: 0, max: 50, int: true },
      { id: "sh-pos-qty", label: "定位桿每次支數", min: 0, max: 1000, int: true },
      { id: "sh-spare", label: "備品／損耗率", min: 0, max: 100 },
    ];
    const c = check(rules);
    if (c.errors.length) return c;

    const A = num("sh-a"), B = num("sh-b"), H = num("sh-h");
    const sx = Number($("sh-sx").value), sy = Number($("sh-sy").value);
    const step = Number(radio("sh-step"));
    const diagMode = $("sh-diag").value;
    const spare = num("sh-spare");
    const kk = 1 + spare / 100;
    const q = (n) => ceil(n * kk);

    const bx = ceil(A / sx), by = ceil(B / sy); // 格數
    const nx = bx + 1, ny = by + 1;              // 立柱排數
    const posts = nx * ny;

    // 高度分配：調整座（上下合計 0.16～0.9m）＋標準基座 0.2m＋主架／輔助桿（0.25m 為單位）
    const room = H - SH.base - 2 * SH.adjMin;
    const T = floor(room / 0.25) * 0.25;
    if (T < 1.0) {
      return { errors: [{ msg: "支撐高度太低，無法使用標準組合（需改用下底座），請洽設計。", quiet: false }], blank: false };
    }
    const adjEach = (H - SH.base - T) / 2;
    const pieces = {};
    let rest = T;
    SH.mains.forEach(function (len) { const k = floor(rest / len); if (k > 0) { pieces["M" + len] = k; rest -= k * len; } });
    SH.aux.forEach(function (len) { const k = floor(rest / len); if (k > 0) { pieces["A" + len] = k; rest -= k * len; } });
    const mainTotal = SH.mains.reduce((s, len) => s + (pieces["M" + len] || 0) * len, 0);

    // 橫桿層數：從標準基座圓盤起，每個步距一層；頂端若還有 0.5m 以上再加一層
    let levels = floor(mainTotal / step) + 1;
    if (mainTotal - floor(mainTotal / step) * step >= 0.5 - 1e-6) levels += 1;
    const lifts = Math.max(levels - 1, 1);

    const items = [];
    const warns = [];
    items.push({ name: "下調整座", spec: "牙管 Ø48.2×600（伸縮 80～450mm）", qty: q(posts), unit: "支", how: "立柱 " + nx + "×" + ny + "＝" + posts + " 支" });
    items.push({ name: "標準基座", spec: "Ø60.2 × 200mm", qty: q(posts), unit: "支", how: "每支立柱 1 支" });
    SH.mains.forEach(function (len) {
      const n = pieces["M" + len];
      if (n) items.push({ name: "主架", spec: "Ø60.2 × " + m(len), qty: q(n * posts), unit: "支", how: "每支立柱 " + n + " 支 × " + posts });
    });
    SH.aux.forEach(function (len) {
      const n = pieces["A" + len];
      if (n) items.push({ name: "輔助桿", spec: "Ø60.2 × " + m(len), qty: q(n * posts), unit: "支", how: "每支立柱 " + n + " 支 × " + posts });
    });
    items.push({ name: "U型調整座", spec: "上調整座（伸縮 80～450mm）", qty: q(posts), unit: "支", how: "每支立柱 1 支" });

    const ledX = bx * ny * levels, ledY = by * nx * levels;
    if (same(sx, sy)) {
      items.push({ name: "橫桿", spec: "Ø48.6 × " + m(sx), qty: q(ledX + ledY), unit: "支", how: "(" + bx + "×" + ny + "＋" + by + "×" + nx + ") × " + levels + " 層" });
    } else {
      items.push({ name: "橫桿（長向）", spec: "Ø48.6 × " + m(sx), qty: q(ledX), unit: "支", how: bx + " 格 × " + ny + " 排 × " + levels + " 層" });
      items.push({ name: "橫桿（寬向）", spec: "Ø48.6 × " + m(sy), qty: q(ledY), unit: "支", how: by + " 格 × " + nx + " 排 × " + levels + " 層" });
    }

    if (diagMode !== "none") {
      let rowsX, rowsY, label;
      if (diagMode === "perimeter") { rowsX = Math.min(2, ny); rowsY = Math.min(2, nx); label = "外圍"; }
      else if (diagMode === "alternate") { rowsX = ceil(ny / 2); rowsY = ceil(nx / 2); label = "隔排"; }
      else { rowsX = ny; rowsY = nx; label = "每排"; }
      const okList = SH.diag[String(step.toFixed(1))];
      const addDiag = function (w, bays, rows, dir) {
        const ok = inList(w, okList);
        if (!ok) warns.push("型錄沒有 " + m(w) + " × " + m(step) + " 的斜桿（" + dir + "），請改間距或步距，或洽實固訂製。");
        return { w: w, n: bays * rows * lifts, how: label + " " + rows + " 排 × " + bays + " 格 × " + lifts + " 層", ok: ok };
      };
      const dx = addDiag(sx, bx, rowsX, "長向"), dy = addDiag(sy, by, rowsY, "寬向");
      if (same(sx, sy)) {
        items.push({ name: "斜桿", spec: m(sx) + " × " + m(step) + (dx.ok ? "" : "（需訂製）"), qty: q(dx.n + dy.n), unit: "支", how: "長向 " + dx.n + "＋寬向 " + dy.n });
      } else {
        items.push({ name: "斜桿（長向）", spec: m(sx) + " × " + m(step) + (dx.ok ? "" : "（需訂製）"), qty: q(dx.n), unit: "支", how: dx.how });
        items.push({ name: "斜桿（寬向）", spec: m(sy) + " × " + m(step) + (dy.ok ? "" : "（需訂製）"), qty: q(dy.n), unit: "支", how: dy.how });
      }
    }

    const posEvery = num("sh-pos-every"), posQty = num("sh-pos-qty");
    if (posEvery > 0 && posQty > 0) {
      const times = ceil(levels / posEvery);
      const a = Math.max(sx, sy), b = Math.min(sx, sy);
      const ok = SH.pos.some((p) => same(p[0], a) && same(p[1], b));
      if (!ok) warns.push("型錄定位桿只有 1.5×1.2、1.5×1.5、1.8×1.2、1.8×1.5、1.8×1.8、2.4×1.5m，" + m(a) + "×" + m(b) + " 需訂製。");
      items.push({ name: "定位桿", spec: m(a) + " × " + m(b) + (ok ? "" : "（需訂製）"), qty: q(times * posQty), unit: "支", how: "每 " + posEvery + " 層裝 1 次，共 " + times + " 次 × " + posQty + " 支" });
    }

    return {
      summary: [["立柱", nx + "×" + ny + "＝" + posts + " 支"], ["橫桿層數", levels + " 層"], ["支撐面積", fmt(A * B, 2) + " m²"], ["支撐體積", fmt(A * B * H, 1) + " m³"]],
      items: items, warns: warns,
      note: "高度分配：下調整座約 " + fmt(adjEach * 1000) + "mm＋標準基座 200mm＋主架／輔助桿 " + fmt(T, 2) + "m＋U型調整座約 " + fmt(adjEach * 1000) +
        "mm＝" + fmt(H, 2) + "m。標準基座上方第一支主架用平主架（不含連接棒）；輔助桿放在最上方。" + (spare > 0 ? " 數量已含備品 " + fmt(spare, 2) + "%。" : ""),
      text: "支撐範圍 " + fmt(A, 2) + "m × " + fmt(B, 2) + "m、高度 " + fmt(H, 2) + "m，立柱間距 " + m(sx) + " × " + m(sy) + "、步距 " + m(step),
      title: "【圓盤系統® 重型支撐架 Ø60.2】",
    };
  }

  // =============== 畫面 ===============
  const errorEl = $("error"), emptyEl = $("empty"), bodyEl = $("result-body");
  const copyMsg = $("copy-msg");
  let last = null;

  function kind() { return radio("kind"); }

  function render() {
    const k = kind();
    $("form-scaffold").hidden = k !== "scaffold";
    $("form-shoring").hidden = k !== "shoring";
    $("sc-deck-levels-field").hidden = $("sc-deck-all").checked;
    copyMsg.textContent = "";

    const r = k === "scaffold" ? calcScaffold() : calcShoring();
    if (r.errors) {
      const shown = r.errors.filter((e) => !e.quiet);
      errorEl.textContent = shown.map((e) => e.msg).join("；");
      errorEl.hidden = !shown.length;
      emptyEl.textContent = k === "scaffold" ? "請輸入外牆總長與搭設高度。" : "請輸入支撐範圍的長、寬與高度。";
      emptyEl.hidden = !(r.blank && !shown.length);
      bodyEl.hidden = true;
      last = null;
      save();
      return;
    }
    last = r;
    errorEl.hidden = true;
    emptyEl.hidden = true;
    bodyEl.hidden = false;

    const sum = $("summary");
    sum.replaceChildren();
    r.summary.forEach(function (s) {
      const d = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = s[0];
      const dd = document.createElement("dd"); dd.textContent = s[1];
      d.append(dt, dd); sum.appendChild(d);
    });

    const w = $("warnings");
    w.replaceChildren();
    r.warns.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; w.appendChild(li); });
    w.hidden = !r.warns.length;

    const rows = $("qty-rows");
    rows.replaceChildren();
    r.items.forEach(function (it) {
      const tr = document.createElement("tr");
      const n = document.createElement("td"); n.className = "name"; n.textContent = it.name;
      const sp = document.createElement("small"); sp.textContent = it.spec; n.appendChild(sp);
      const qd = document.createElement("td"); qd.className = "num"; qd.textContent = fmt(it.qty);
      const u = document.createElement("span"); u.className = "unit"; u.textContent = it.unit; qd.appendChild(u);
      const h = document.createElement("td"); h.className = "how"; h.textContent = it.how;
      tr.append(n, qd, h); rows.appendChild(tr);
    });
    $("note").textContent = r.note;
    save();
  }

  // 選架寬時，自動帶入建議的踏板／蓋板片數
  $("sc-width").addEventListener("change", function () {
    const d = SC.deckByWidth[$("sc-width").value];
    if (d) { $("sc-board").value = d[0]; $("sc-cover").value = d[1]; }
  });

  // ---- 複製、列印 ----
  function resultText() {
    const r = last;
    const lines = [r.title, r.text, r.summary.map((s) => s[0] + " " + s[1]).join("、"), ""];
    r.items.forEach((it) => lines.push(it.name + "（" + it.spec + "）：" + fmt(it.qty) + " " + it.unit));
    if (r.warns.length) { lines.push(""); r.warns.forEach((t) => lines.push("⚠ " + t)); }
    lines.push("", "※ 依實固公開型錄規格估算，非原廠設計；實際請依結構計算與設計圖。");
    return lines.join("\n");
  }
  $("copy-btn").addEventListener("click", async function () {
    if (!last) return;
    const text = resultText();
    const ok = "已複製，可以貼到 LINE 或訊息裡。";
    try {
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = ok;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let done = false;
      try { done = document.execCommand("copy"); } catch (e2) { done = false; }
      ta.remove();
      copyMsg.textContent = done ? ok : "無法自動複製，請改用列印或截圖。";
    }
  });
  $("print-btn").addEventListener("click", function () { window.print(); });

  // ---- 記住上次輸入（只存在這台裝置） ----
  const FIELDS = Array.from(document.querySelectorAll(".calc-form input, .calc-form select, .tabs input"));
  function save() {
    try {
      const data = {};
      FIELDS.forEach(function (el) {
        if (el.type === "radio") { if (el.checked) data["r:" + el.name] = el.value; }
        else if (el.type === "checkbox") data["c:" + el.id] = el.checked;
        else data["v:" + el.id] = el.value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* 存不了不影響計算 */ }
  }
  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return;
      FIELDS.forEach(function (el) {
        if (el.type === "radio") { if (data["r:" + el.name] === el.value) el.checked = true; }
        else if (el.type === "checkbox") { if (typeof data["c:" + el.id] === "boolean") el.checked = data["c:" + el.id]; }
        else if (typeof data["v:" + el.id] === "string") {
          if (el.tagName === "SELECT" && !Array.from(el.options).some((o) => o.value === data["v:" + el.id])) return;
          el.value = data["v:" + el.id];
        }
      });
    } catch (e) { /* 讀不到就用預設值 */ }
  }

  // ---- 事件 ----
  let composing = false;
  document.addEventListener("compositionstart", function () { composing = true; });
  document.addEventListener("compositionend", function (e) {
    composing = false;
    if (e.target && e.target.id) touched[e.target.id] = true;
    render();
  });
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id) touched[e.target.id] = true;
    if (!composing) render();
  });
  document.addEventListener("change", render);
  document.addEventListener("keyup", function () { if (!composing) render(); });
  document.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));

  restore();
  render();
})();
