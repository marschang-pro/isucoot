// 圓盤系統® 數量估算（實固施工架 Ø48.6／重型支撐架 Ø60.2）
// 全部在瀏覽器裡計算，不連任何資料庫。
//
// 規格來源：實固股份有限公司官網公開型錄
//   ・「圓盤系統®」施工架（2026）：主架 Ø48.6×2.5，長 0.5/1.0/1.5/2.0/3.0m，圓盤間距 500mm；
//     橫桿 Ø42.7×2.3，0.9/1.2/1.5/1.8m（特殊 0.762/1.219/1.829m）；
//     斜桿 1.2×2.0、1.5×2.0、1.8×2.0m；調整座 600mm（可調 80～500mm）；
//     腳踏板 550mm 寬、蓋板 265mm 寬，長 1200/1500/1800mm。
//   ・「圓盤系統®」重型支撐架（2025）：主架 Ø60.2×3.2，長 1.0/1.5/2.0/3.0m，圓盤間距 500mm；
//     標準基座 200mm；輔助桿 0.25/0.5m；上下調整座型錄伸縮 80～450mm（本工具依使用者規定取 80～400mm）；
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
    adjMin: 0.08, adjMax: 0.40,
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
      draw: { type: "scaffold", L: L, H: H, span: span, width: width, spans: spans, levels: levels, lift: SC.lift,
        deckLevels: deckLevels, diagEvery: diagEvery, rails: rails, guard: guard, closed: closed, tieOn: tieOn,
        tieV: tieOn ? num("sc-tieV") : 0 },
      summary: [["層數", levels + " 層"], ["跨數", spans + " 跨"], ["立柱", posts + " 支"], ["立面面積", fmt(L * H, 2) + " m²"]],
      items: items, warns: warns,
      note: "層高 2.0m，最上層踏板高約 " + fmt(levels * SC.lift, 2) + "m；每支立柱主架總長 " + fmt(stdHeight, 2) + "m" + (guard ? "（含頂層護欄 1.0m）" : "") +
        "。最下面一支可用平主架（不含連接棒）。" + (spare > 0 ? " 數量已含備品 " + fmt(spare, 2) + "%。" : ""),
      text: "外牆總長 " + fmt(L, 2) + "m、搭設高度 " + fmt(H, 2) + "m（" + (closed ? "環繞一圈" : "單面") + "），跨距 " + m(span) + "、架寬 " + m(width),
      title: "【圓盤系統® 施工架 Ø48.6】",
    };
  }

  // 主架長度 1.0/1.5/2.0/3.0m：用最少支數湊出 len（0.5m 的倍數）；同樣支數時優先用長的。
  // len 為 0 時回傳空陣列；湊不出來回傳 null。
  function bestFrameSet(len) {
    const units = Math.round(len / 0.5); // 以 0.5m 為單位
    if (units === 0) return [];
    if (units < 2) return null;
    const sizes = SH.mains.map((l) => Math.round(l / 0.5)); // [6,4,3,2]
    const best = new Array(units + 1).fill(null);
    best[0] = [];
    for (let u = 1; u <= units; u++) {
      sizes.forEach(function (s) {
        if (u >= s && best[u - s]) {
          const cand = best[u - s].concat([s]);
          if (!best[u] || cand.length < best[u].length) best[u] = cand;
        }
      });
    }
    return best[units] ? best[units].sort((a, b) => b - a).map((s) => s * 0.5) : null;
  }

  // 依支撐高度 H 決定每支立柱的組合（由下往上）：
  //   下調整座 ＋ 標準基座 0.2m ＋ 平主架 ＋ 主架 ＋ 輔助桿（0.25 或 0.5m，最多 1 支）＋ U型調整座
  // ・平主架：支撐高度超過 3.5m 用 3.0m；3.5m 以下用 1.5m；高度太低放不下 1.5m 時改用 1.0m。
  // ・上下調整座各 80～400mm，兩支等長。
  // ・主架＋輔助桿盡量用滿（以 0.25m 為單位），剩下的交給調整座。
  function pickFrames(H) {
    const lo = 2 * SH.adjMin, hi = 2 * SH.adjMax;
    const flat = H > 3.5 + 1e-9 ? 3.0 : (H - SH.base - 1.5 >= lo - 1e-9 ? 1.5 : 1.0);
    const R = H - SH.base - flat;           // 平主架以上要湊的高度（含上下調整座）
    if (R < lo - 1e-9) return null;
    for (let X = floor((R - lo) / 0.25) * 0.25; X >= R - hi - 1e-9 && X >= -1e-9; X -= 0.25) {
      const r = Math.round((X % 0.5) * 100) / 100;
      const auxOptions = r > 0 ? [0.25] : [0, 0.5];
      for (const aux of auxOptions) {
        const set = bestFrameSet(X - aux);
        if (set) {
          const mains = {};
          set.forEach((l) => { mains[l] = (mains[l] || 0) + 1; });
          return { flat: flat, aux: aux, mains: mains, total: flat + X - aux, adj: (R - X) / 2 };
        }
      }
    }
    return null;
  }

  // =============== 重型支撐架 ===============
  function calcShoring() {
    const rules = [
      { id: "sh-a", label: "長度", min: 0.5, max: 1000, req: true },
      { id: "sh-b", label: "寬度", min: 0.5, max: 1000, req: true },
      { id: "sh-h", label: "支撐高度", min: 1.5, max: 40, req: true },
      { id: "sh-pos-every", label: "定位桿每幾層裝一次", min: 0, max: 50, int: true },
      { id: "sh-pos-qty", label: "定位桿每次支數", min: 0, max: 1000, int: true },
      { id: "sh-spare", label: "備品／損耗率", min: 0, max: 100 },
    ];
    const tower = radio("sh-layout") === "tower";
    if (tower) {
      rules.push(
        { id: "sh-cx", label: "每座格數（長向）", min: 1, max: 20, int: true },
        { id: "sh-cy", label: "每座格數（寬向）", min: 1, max: 20, int: true },
        { id: "sh-gx", label: "塔架淨距（長向）", min: 0, max: 50 },
        { id: "sh-gy", label: "塔架淨距（寬向）", min: 0, max: 50 }
      );
    }
    const c = check(rules);
    if (c.errors.length) return c;

    const A = num("sh-a"), B = num("sh-b"), H = num("sh-h");
    const sx = Number($("sh-sx").value), sy = Number($("sh-sy").value);
    const step = Number(radio("sh-step"));
    const diagMode = $("sh-diag").value;
    const spare = num("sh-spare");
    const kk = 1 + spare / 100;

    // 排列方式：
    //   滿堂：整個範圍連續搭設。
    //   單座塔架：每座 cx 格 × cy 格，座與座之間留淨距；淨距為「最大值」，
    //             頭尾都要撐到，座數＝無條件進位（(長度－單座長) ÷ (單座長＋淨距)）＋ 1。
    let bx, by, M = 1, nTx = 1, nTy = 1, gapX = 0, gapY = 0;
    const warns = [];
    if (tower) {
      bx = num("sh-cx"); by = num("sh-cy");
      const Lx = bx * sx, Ly = by * sy;
      const gx = num("sh-gx"), gy = num("sh-gy");
      const count = function (len, unit, gap, dir) {
        if (len < 2 * unit - 1e-9) {
          if (len > unit + 1e-9) warns.push(dir + "長度 " + m(len) + " 放不下兩座（單座 " + m(unit) + "），以 1 座計，邊緣可能撐不到。");
          else if (len < unit - 1e-9) warns.push(dir + "單座 " + m(unit) + " 比支撐範圍 " + m(len) + " 還大，以 1 座計。");
          return 1;
        }
        return ceil((len - unit) / (unit + gap)) + 1;
      };
      nTx = count(A, Lx, gx, "長向"); nTy = count(B, Ly, gy, "寬向");
      gapX = nTx > 1 ? (A - nTx * Lx) / (nTx - 1) : 0;
      gapY = nTy > 1 ? (B - nTy * Ly) / (nTy - 1) : 0;
      M = nTx * nTy;
    } else {
      bx = ceil(A / sx); by = ceil(B / sy);
    }
    const q = (n) => ceil(n * M * kk);        // 每座數量 × 座數 × 備品
    const nx = bx + 1, ny = by + 1;            // 立柱排數（滿堂為全部；單座為每座）
    const posts = nx * ny;

    // 高度組裝順序見 pickFrames()
    const frames = pickFrames(H);
    if (!frames) {
      return { errors: [{ msg: "這個高度無法用標準構件組合，請洽設計。", quiet: false }], blank: false };
    }
    const adjEach = frames.adj;
    const mainTotal = frames.total;      // 平主架＋主架的長度（橫桿圓盤所在範圍）
    const auxLen = frames.aux;           // 0、0.25 或 0.5
    const flatLen = frames.flat;         // 平主架長度
    const mainCounts = frames.mains;     // 其餘主架 { 長度: 支數 }

    // 橫桿層數：從標準基座圓盤起，每個步距一層；頂端若還有 0.5m 以上再加一層
    let levels = floor(mainTotal / step) + 1;
    if (mainTotal - floor(mainTotal / step) * step >= 0.5 - 1e-6) levels += 1;
    const lifts = Math.max(levels - 1, 1);

    const items = [];
    items.push({ name: "下調整座", spec: "牙管 Ø48.2×600（使用 80～400mm）", qty: q(posts), unit: "支", how: "立柱 " + nx + "×" + ny + "＝" + posts + " 支" });
    items.push({ name: "標準基座", spec: "Ø60.2 × 200mm", qty: q(posts), unit: "支", how: "每支立柱 1 支" });
    items.push({ name: "平主架", spec: "Ø60.2 × " + m(flatLen) + "（不含連接棒）", qty: q(posts), unit: "支", how: "每支立柱最下方 1 支" });
    SH.mains.forEach(function (len) {
      const n = mainCounts[len];
      if (n) items.push({ name: "主架", spec: "Ø60.2 × " + m(len), qty: q(n * posts), unit: "支", how: "每支立柱 " + n + " 支 × " + posts });
    });
    if (auxLen > 0) {
      items.push({ name: "輔助桿", spec: "Ø60.2 × " + m(auxLen), qty: q(posts), unit: "支", how: "每支立柱最上方 1 支" });
    }
    items.push({ name: "U型調整座", spec: "上調整座（使用 80～400mm）", qty: q(posts), unit: "支", how: "每支立柱 1 支" });

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

    if (tower) items.forEach(function (it) { it.how = "每座：" + it.how + "；× " + M + " 座"; });

    const summary = tower
      ? [["塔架", nTx + "×" + nTy + "＝" + M + " 座"], ["立柱", fmt(posts * M) + " 支（每座 " + posts + "）"], ["橫桿層數", levels + " 層"],
         ["實際淨距", (nTx > 1 ? m(gapX) : "—") + " × " + (nTy > 1 ? m(gapY) : "—")]]
      : [["立柱", nx + "×" + ny + "＝" + posts + " 支"], ["橫桿層數", levels + " 層"], ["支撐面積", fmt(A * B, 2) + " m²"], ["支撐體積", fmt(A * B * H, 1) + " m³"]];
    const layoutNote = tower
      ? "排列：每座 " + bx + "×" + by + " 格（" + m(bx * sx) + " × " + m(by * sy) + "），長向 " + nTx + " 座、寬向 " + nTy + " 座，座與座淨距不超過設定值（實際 " +
        (nTx > 1 ? m(gapX) : "—") + " × " + (nTy > 1 ? m(gapY) : "—") + "）；塔架之間未計連接橫桿。"
      : "";

    const mainOrder = [];
    Object.keys(mainCounts).map(Number).sort((a, b) => b - a).forEach((l) => { for (let i = 0; i < mainCounts[l]; i++) mainOrder.push(l); });
    return {
      draw: { type: "shoring", A: A, B: B, H: H, sx: sx, sy: sy, bx: bx, by: by, nx: nx, ny: ny, tower: tower,
        nTx: nTx, nTy: nTy, gapX: gapX, gapY: gapY, adj: adjEach, flat: flatLen, mains: mainOrder, aux: auxLen,
        levels: levels, step: step, diagMode: diagMode },
      summary: summary,
      items: items, warns: warns,
      note: layoutNote + "高度組裝（由下往上）：下調整座約 " + fmt(adjEach * 1000) + "mm＋標準基座 200mm＋平主架 " + m(flatLen) +
        (Object.keys(mainCounts).length ? "＋主架 " + Object.keys(mainCounts).map(Number).sort((a, b) => b - a).map((l) => m(l) + "×" + mainCounts[l]).join("、") : "") +
        (auxLen > 0 ? "＋輔助桿 " + m(auxLen) : "") + "＋U型調整座約 " + fmt(adjEach * 1000) + "mm＝" + fmt(H, 2) + "m。" +
        (spare > 0 ? " 數量已含備品 " + fmt(spare, 2) + "%。" : ""),
      text: "支撐範圍 " + fmt(A, 2) + "m × " + fmt(B, 2) + "m、高度 " + fmt(H, 2) + "m，立柱間距 " + m(sx) + " × " + m(sy) + "、步距 " + m(step) +
        (tower ? "；單座塔架 " + bx + "×" + by + " 格，淨距（最大）" + m(num("sh-gx")) + " × " + m(num("sh-gy")) + "，共 " + M + " 座" : "；滿堂搭設"),
      title: "【圓盤系統® 重型支撐架 Ø60.2】",
    };
  }


  // =============== 簡易圖說示意（SVG） ===============
  // 只用數字與固定文字組成，不放使用者輸入的文字。
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }
  const r1 = (x) => Math.round(x * 10) / 10;
  function line(g, x1, y1, x2, y2, cls) { g.appendChild(svgEl("line", { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: cls })); }
  function rect(g, x, y, w, h, cls) { g.appendChild(svgEl("rect", { x: r1(x), y: r1(y), width: r1(Math.max(w, 0.5)), height: r1(Math.max(h, 0.5)), class: cls })); }
  function text(g, x, y, t, cls, anchor) { g.appendChild(svgEl("text", { x: r1(x), y: r1(y), class: cls || "fig-t", "text-anchor": anchor || "middle" }, t)); }
  function dot(g, x, y, r, cls) { g.appendChild(svgEl("circle", { cx: r1(x), cy: r1(y), r: r, class: cls || "fig-post-dot" })); }
  // 尺寸線：水平或垂直，兩端短線＋中間文字
  function dimH(g, x1, x2, y, t) {
    line(g, x1, y, x2, y, "fig-dim"); line(g, x1, y - 4, x1, y + 4, "fig-dim"); line(g, x2, y - 4, x2, y + 4, "fig-dim");
    text(g, (x1 + x2) / 2, y - 5, t, "fig-t small");
  }
  function dimV(g, x, y1, y2, t) {
    line(g, x, y1, x, y2, "fig-dim"); line(g, x - 4, y1, x + 4, y1, "fig-dim"); line(g, x - 4, y2, x + 4, y2, "fig-dim");
    const tx = x - 6, ty = (y1 + y2) / 2;
    g.appendChild(svgEl("text", { x: r1(tx), y: r1(ty), class: "fig-t small", "text-anchor": "middle", transform: "rotate(-90 " + r1(tx) + " " + r1(ty) + ")" }, t));
  }
  function figure(title, w, h, build, caption) {
    const wrap = document.createElement("figure");
    wrap.className = "fig";
    const cap = document.createElement("figcaption");
    cap.textContent = title;
    const svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": title, class: "fig-svg" });
    build(svg);
    wrap.append(cap, svg);
    if (caption) { const p = document.createElement("p"); p.className = "fig-note"; p.textContent = caption; wrap.appendChild(p); }
    return wrap;
  }

  function drawFigures(d) {
    const box = $("figures");
    box.replaceChildren();
    if (!d) return;
    if (d.type === "shoring") { box.appendChild(shoringPlan(d)); box.appendChild(shoringElev(d)); }
    else { box.appendChild(scaffoldElev(d)); box.appendChild(scaffoldSection(d)); }
  }

  // ---- 支撐架：平面配置圖 ----
  function shoringPlan(d) {
    const W = 340, pad = 34;
    const tw = d.tower ? d.bx * d.sx : 0, th = d.tower ? d.by * d.sy : 0;
    const extX = d.tower ? Math.max(d.A, tw) : d.bx * d.sx;
    const extY = d.tower ? Math.max(d.B, th) : d.by * d.sy;
    const sc = Math.min((W - pad * 2) / extX, 260 / extY);
    const H = extY * sc + pad * 2;
    const X = (x) => pad + x * sc, Y = (y) => pad + y * sc;
    const many = (d.tower ? d.nTx * (d.nx) : d.nx) > 60 || (d.tower ? d.nTy * d.ny : d.ny) > 60;
    return figure("平面配置圖", W, H, function (g) {
      rect(g, X(0), Y(0), d.A * sc, d.B * sc, "fig-area");
      const drawGrid = function (ox, oy) {
        const x0 = X(ox), y0 = Y(oy);
        rect(g, x0, y0, d.bx * d.sx * sc, d.by * d.sy * sc, d.tower ? "fig-tower" : "fig-none");
        if (many) return;
        for (let i = 0; i < d.nx; i++) line(g, x0 + i * d.sx * sc, y0, x0 + i * d.sx * sc, y0 + d.by * d.sy * sc, "fig-ledger");
        for (let j = 0; j < d.ny; j++) line(g, x0, y0 + j * d.sy * sc, x0 + d.bx * d.sx * sc, y0 + j * d.sy * sc, "fig-ledger");
        const rr = Math.max(1.2, Math.min(3, d.sx * sc / 5));
        for (let i = 0; i < d.nx; i++) for (let j = 0; j < d.ny; j++) dot(g, x0 + i * d.sx * sc, y0 + j * d.sy * sc, rr);
      };
      if (d.tower) {
        for (let i = 0; i < d.nTx; i++) for (let j = 0; j < d.nTy; j++) {
          const ox = d.nTx > 1 ? i * (tw + d.gapX) : 0, oy = d.nTy > 1 ? j * (th + d.gapY) : 0;
          drawGrid(ox, oy);
        }
        if (d.nTx > 1) dimH(g, X(tw), X(tw + d.gapX), Y(th / 2) + 4, m(d.gapX));
        if (d.nTy > 1) dimV(g, X(tw / 2) + 6, Y(th), Y(th + d.gapY), m(d.gapY));
        dimH(g, X(0), X(tw), Y(extY) + 14, "單座 " + m(tw));
      } else {
        drawGrid(0, 0);
        dimH(g, X(0), X(d.sx), Y(extY) + 14, "間距 " + m(d.sx));
        dimV(g, X(extX) + 18, Y(0), Y(d.sy), m(d.sy));
      }
      text(g, X(d.A / 2), Y(0) - 18, "長 " + fmt(d.A, 2) + "m", "fig-t");
      g.appendChild(svgEl("text", { x: r1(X(0) - 22), y: r1(Y(d.B / 2)), class: "fig-t", "text-anchor": "middle",
        transform: "rotate(-90 " + r1(X(0) - 22) + " " + r1(Y(d.B / 2)) + ")" }, "寬 " + fmt(d.B, 2) + "m"));
    }, (many ? "立柱很多，平面圖只畫外框。" : "") + "虛線＝支撐範圍，圓點＝立柱，細線＝橫桿。");
  }

  // ---- 支撐架：立面圖（含立柱高度組成）----
  function shoringElev(d) {
    const W = 340, top = 20, bottom = 28, labelW = 128;
    const bays = Math.min(d.bx, 3);
    const sc = Math.min((W - labelW - 24) / (bays * d.sx), 330 / d.H);
    const Hpx = d.H * sc + top + bottom;
    const x0 = 20, Yb = top + d.H * sc;          // 地面
    const Y = (h) => Yb - h * sc;
    // 由下往上的構件
    const parts = [["下調整座", d.adj, "fig-adj"], ["標準基座", 0.2, "fig-base"], ["平主架", d.flat, "fig-flat"]];
    d.mains.forEach((l) => parts.push(["主架", l, "fig-main"]));
    if (d.aux > 0) parts.push(["輔助桿", d.aux, "fig-aux"]);
    parts.push(["U型調整座", d.adj, "fig-adj"]);
    return figure("立面圖（" + (d.tower ? "單座" : "長向前 " + bays + " 格") + "）", W, Hpx, function (g) {
      line(g, 4, Yb, W - 4, Yb, "fig-ground");
      // 橫桿層：標準基座圓盤起，每個步距一層
      const discBase = d.adj + 0.1, topFrame = d.adj + 0.2 + d.flat + d.mains.reduce((a, b) => a + b, 0);
      const lv = [];
      for (let k = 0; k < d.levels; k++) { const h = Math.min(discBase + k * d.step, topFrame - 0.25); lv.push(h); }
      const xr = x0 + bays * d.sx * sc;
      lv.forEach((h) => line(g, x0, Y(h), xr, Y(h), "fig-ledger-b"));
      // 斜桿：每格每層同一方向
      if (d.diagMode !== "none") for (let k = 0; k + 1 < lv.length; k++) for (let b = 0; b < bays; b++)
        line(g, x0 + b * d.sx * sc, Y(lv[k]), x0 + (b + 1) * d.sx * sc, Y(lv[k + 1]), "fig-diag");
      // 立柱：分段上色
      for (let i = 0; i <= bays; i++) {
        let h = 0;
        const x = x0 + i * d.sx * sc;
        parts.forEach(function (p) { rect(g, x - 3, Y(h + p[1]), 6, p[1] * sc, p[2]); h += p[1]; });
      }
      // U 型頭與底板
      for (let i = 0; i <= bays; i++) { const x = x0 + i * d.sx * sc; line(g, x - 7, Y(d.H), x + 7, Y(d.H), "fig-cap"); line(g, x - 7, Yb, x + 7, Yb, "fig-cap"); }
      // 右側：組成標示（由上往下列出）
      const lx = xr + 22;
      let h = 0;
      const marks = parts.map((p) => { const mid = h + p[1] / 2; h += p[1]; return [p[0], p[1], mid, p[2]]; });
      const minGap = 13;
      let lastY = -1e9;
      const placed = marks.slice().reverse().map(function (mk) {
        let y = Math.max(Y(mk[2]) + 4, lastY + minGap);
        lastY = y;
        return [mk, y];
      });
      const overflow = lastY - (Yb - 3);
      placed.forEach(function (pp) {
        const mk = pp[0]; let y = pp[1] - Math.max(0, overflow);
        line(g, xr + 6, Y(mk[2]), lx - 3, y - 4, "fig-lead");
        rect(g, lx, y - 9, 8, 8, mk[3]);
        const len = mk[1] < 1 ? fmt(mk[1] * 1000) + "mm" : m(mk[1]);
        text(g, lx + 12, y - 1, mk[0] + " " + len, "fig-t small", "start");
      });
      dimV(g, 12, Y(0), Y(d.H), "高 " + fmt(d.H, 2) + "m");
      if (bays < d.bx) text(g, xr + 10, Y(d.H / 2), "⋯", "fig-t");
      dimH(g, x0, x0 + d.sx * sc, Yb + 16, m(d.sx));
    }, "粗橫線＝橫桿層（步距 " + m(d.step) + "），斜線＝斜桿（同一方向組搭）。");
  }

  // ---- 施工架：立面圖 ----
  function scaffoldElev(d) {
    const W = 340, top = 22, bottom = 30;
    const bays = Math.min(d.spans, 5);
    const totalH = d.levels * d.lift + (d.guard ? 1.0 : 0);
    const sc = Math.min((W - 70) / (bays * d.span), 330 / totalH);
    const x0 = 44, Yb = top + totalH * sc;
    const Y = (h) => Yb - h * sc;
    const Hpx = totalH * sc + top + bottom;
    const xr = x0 + bays * d.span * sc;
    const firstDeck = d.levels - d.deckLevels + 1; // 由上往下鋪
    return figure("立面圖（沿牆前 " + bays + " 跨）", W, Hpx, function (g) {
      line(g, 4, Yb, W - 4, Yb, "fig-ground");
      for (let i = 0; i <= bays; i++) rect(g, x0 + i * d.span * sc - 2.5, Y(totalH), 5, totalH * sc, "fig-main");
      for (let k = 0; k <= d.levels; k++) line(g, x0, Y(k * d.lift), xr, Y(k * d.lift), "fig-ledger-b");
      for (let k = 1; k <= d.levels; k++) {
        if (k >= firstDeck) rect(g, x0, Y(k * d.lift) - 3, bays * d.span * sc, 3, "fig-deck");
        if (d.rails >= 1) line(g, x0, Y(k * d.lift + 0.5), xr, Y(k * d.lift + 0.5), "fig-rail");
        if (d.rails >= 2) line(g, x0, Y(k * d.lift + 1.0), xr, Y(k * d.lift + 1.0), "fig-rail");
      }
      if (d.diagEvery > 0) for (let k = 0; k < d.levels; k++) for (let b = 0; b < bays; b += d.diagEvery)
        line(g, x0 + b * d.span * sc, Y(k * d.lift), x0 + (b + 1) * d.span * sc, Y((k + 1) * d.lift), "fig-diag");
      if (bays < d.spans) text(g, xr + 14, Y(totalH / 2), "⋯", "fig-t");
      dimV(g, 16, Y(0), Y(d.levels * d.lift), "高 " + fmt(d.levels * d.lift, 2) + "m");
      dimH(g, x0, x0 + d.span * sc, Yb + 16, "跨距 " + m(d.span));
      if (d.levels >= 1) dimV(g, xr + 30 > W - 6 ? W - 8 : xr + 30, Y(0), Y(d.lift), m(d.lift));
    }, "共 " + d.spans + " 跨 × " + d.levels + " 層。黃色＝踏板層，細虛線＝外側護欄，斜線＝外側斜桿（每 " + d.diagEvery + " 跨 1 支）。");
  }

  // ---- 施工架：斷面圖 ----
  function scaffoldSection(d) {
    const W = 340, top = 22, bottom = 30;
    const totalH = d.levels * d.lift + (d.guard ? 1.0 : 0);
    const sc = Math.min(150 / d.width, 330 / totalH);
    // 高度照比例；寬度方向若太窄就放大，方便看清楚（圖說會註明）
    const xs = Math.max(sc, 90 / d.width);
    const stretched = xs > sc + 1e-6;
    const wallX = 70, gap = 0.3, xi = wallX + gap * xs, xo = xi + d.width * xs;
    const Yb = top + totalH * sc;
    const Y = (h) => Yb - h * sc;
    const firstDeck = d.levels - d.deckLevels + 1;
    return figure("斷面圖（進深方向）", W, totalH * sc + top + bottom, function (g) {
      line(g, 4, Yb, W - 4, Yb, "fig-ground");
      rect(g, wallX - 26, Y(totalH + 0.3), 26, (totalH + 0.3) * sc, "fig-wall");
      text(g, wallX - 13, Y(totalH + 0.3) - 6, "牆", "fig-t small");
      rect(g, xi - 2.5, Y(d.levels * d.lift), 5, d.levels * d.lift * sc, "fig-main");
      rect(g, xo - 2.5, Y(totalH), 5, totalH * sc, "fig-main");
      for (let k = 0; k <= d.levels; k++) line(g, xi, Y(k * d.lift), xo, Y(k * d.lift), "fig-ledger-b");
      for (let k = 1; k <= d.levels; k++) {
        if (k >= firstDeck) rect(g, xi + 2, Y(k * d.lift) - 3, d.width * xs - 4, 3, "fig-deck");
        if (d.rails >= 1) line(g, xo, Y(k * d.lift + 0.5), xo + 10, Y(k * d.lift + 0.5), "fig-rail");
        if (d.rails >= 2) line(g, xo, Y(k * d.lift + 1.0), xo + 10, Y(k * d.lift + 1.0), "fig-rail");
      }
      if (d.tieOn && d.tieV > 0) for (let h = d.tieV; h < d.levels * d.lift; h += d.tieV) {
        line(g, wallX, Y(h), xi, Y(h), "fig-tie");
      }
      dimH(g, xi, xo, Yb + 16, "架寬 " + m(d.width));
      dimV(g, xo + 40, Y(0), Y(d.levels * d.lift), "高 " + fmt(d.levels * d.lift, 2) + "m");
      if (d.guard) text(g, xo + 12, Y(totalH) + 4, "護欄 1.0m", "fig-t small", "start");
    }, (d.tieOn ? "紅線＝壁連（垂直每 " + m(d.tieV) + "）。" : "") + (stretched ? "寬度方向已放大，未按比例。" : "") + "牆與架之間的距離僅為示意。");
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
    $("sh-tower-fields").hidden = radio("sh-layout") !== "tower";
    copyMsg.textContent = "";

    const r = k === "scaffold" ? calcScaffold() : calcShoring();
    if (r.errors) {
      const shown = r.errors.filter((e) => !e.quiet);
      errorEl.textContent = shown.map((e) => e.msg).join("；");
      errorEl.hidden = !shown.length;
      emptyEl.textContent = k === "scaffold" ? "請輸入外牆總長與搭設高度。" : "請輸入支撐範圍的長、寬與高度。";
      emptyEl.hidden = !(r.blank && !shown.length);
      bodyEl.hidden = true;
      $("figures").replaceChildren();
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
    drawFigures(r.draw);
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

  // =============== PWA：離線使用與安裝到主畫面 ===============
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* 註冊失敗不影響計算 */ });
    });
  }

  const offlineBar = $("offline-bar");
  function updateOnline() { offlineBar.hidden = navigator.onLine !== false; }
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();

  const INSTALL_DISMISS_KEY = "sucoot-qty-install-dismissed";
  const installBar = $("install-bar"), installBtn = $("install-btn"), installText = $("install-text");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch (e) { /* 忽略 */ }
  let deferredPrompt = null;

  // Android Chrome／電腦版 Chrome、Edge：瀏覽器允許時顯示「安裝」按鈕
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (standalone || dismissed) return;
    installText.textContent = "把這個工具安裝到主畫面，沒有網路也能用。";
    installBtn.hidden = false;
    installBar.hidden = false;
  });
  installBtn.addEventListener("click", async function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* 忽略 */ }
    deferredPrompt = null;
    installBar.hidden = true;
  });
  window.addEventListener("appinstalled", function () { installBar.hidden = true; });

  // iPhone／iPad Safari 沒有安裝按鈕，改顯示操作步驟
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isInApp = /Line\/|FBAN|FBAV|Instagram/i.test(ua);
  if (isIOS && !standalone && !dismissed) {
    installText.textContent = isInApp
      ? "請先用 Safari 開啟這個網頁，再點「分享」→「加入主畫面」，就能像 App 一樣使用。"
      : "點下方「分享」按鈕 →「加入主畫面」，就能像 App 一樣使用，沒有網路也能算。";
    installBtn.hidden = true;
    installBar.hidden = false;
  }

  $("install-close").addEventListener("click", function () {
    installBar.hidden = true;
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch (e) { /* 忽略 */ }
  });
})();
