// 鷹架數量計算：框式（門型）施工架
// 全部在瀏覽器裡計算，不連任何資料庫。
//
// 計算規則（估算用）：
//   層數       = 無條件進位（搭設高度 ÷ 門型架高度）
//   跨數       = 無條件進位（外牆總長 ÷ 跨距）
//   門型架列數 = 跨數 ＋ 1（不封閉）；環繞一圈時 = 跨數
//   門型架     = 列數 × 層數
//   交叉拉桿   = 跨數 × 層數 × 每跨每層支數
//   踏板       = 跨數 × 鋪踏板層數 × 每跨每層片數
//   底座       = 列數 × 2（每座門型架兩支腳）
//   連接銷     = 列數 × 2 × （層數 − 1）（上下層門型架接合處）
//   壁連座     = 水平點數 × 垂直點數
//                水平點數 = 無條件進位（總長 ÷ 水平間距）（不封閉再＋1）
//                垂直點數 = 無條件進位（高度 ÷ 垂直間距）
//   每項最後再乘上（1＋備品率）並無條件進位。
(function () {
  "use strict";

  const DEFAULT_SPEC = { frameHeight: 1.7, span: 1.829, bracesPerSpan: 2, tieH: 7.5, tieV: 5.5 };
  const STORAGE_KEY = "scaffold-calc-inputs-v1";
  const EPS = 1e-9; // 避免 15.3 ÷ 1.7 這類小數誤差讓進位多算一層

  const form = document.getElementById("calc-form");
  const $ = (id) => document.getElementById(id);

  const errorEl = $("error");
  const emptyEl = $("empty");
  const bodyEl = $("result-body");
  const rowsEl = $("qty-rows");
  const copyMsg = $("copy-msg");

  const ceil = (x) => Math.ceil(x - EPS);
  const fmt = (n, digits) =>
    n.toLocaleString("zh-TW", { maximumFractionDigits: digits == null ? 0 : digits });

  // ---- 讀取輸入 ----
  function num(id) {
    const raw = $(id).value.trim();
    return raw === "" ? NaN : Number(raw);
  }

  function readInputs() {
    return {
      length: num("length"),
      height: num("height"),
      closed: form.querySelector('input[name="layout"]:checked').value === "closed",
      boardsPerSpan: num("boardsPerSpan"),
      boardAllLevels: $("boardAllLevels").checked,
      boardLevels: num("boardLevels"),
      spare: num("spare"),
      frameHeight: num("frameHeight"),
      span: num("span"),
      bracesPerSpan: num("bracesPerSpan"),
      tieH: num("tieH"),
      tieV: num("tieV"),
    };
  }

  // ---- 檢查輸入 ----
  const CHECKS = [
    { id: "length", label: "外牆總長", min: 0.1, max: 10000 },
    { id: "height", label: "搭設高度", min: 0.1, max: 200 },
    { id: "boardsPerSpan", label: "每跨每層踏板片數", min: 0, max: 10, int: true },
    { id: "spare", label: "備品／損耗率", min: 0, max: 100 },
    { id: "frameHeight", label: "門型架高度", min: 0.5, max: 5 },
    { id: "span", label: "跨距", min: 0.5, max: 5 },
    { id: "bracesPerSpan", label: "每跨每層交叉拉桿支數", min: 0, max: 4, int: true },
    { id: "tieH", label: "壁連座水平間距", min: 0.5, max: 20 },
    { id: "tieV", label: "壁連座垂直間距", min: 0.5, max: 20 },
  ];

  function validate(v) {
    const errors = [];
    const checks = CHECKS.slice();
    if (!v.boardAllLevels) checks.push({ id: "boardLevels", label: "鋪踏板的層數", min: 0, max: 200, int: true });
    checks.forEach(function (c) {
      const el = $(c.id);
      const val = v[c.id];
      let msg = "";
      if (Number.isNaN(val)) msg = "請填寫「" + c.label + "」";
      else if (val < c.min || val > c.max) msg = "「" + c.label + "」要介於 " + c.min + "～" + c.max;
      else if (c.int && !Number.isInteger(val)) msg = "「" + c.label + "」要填整數";
      el.classList.toggle("invalid", !!msg && !(isBlankRequired(c.id) && !touched[c.id]));
      if (msg) errors.push({ id: c.id, msg: msg });
    });
    return errors;
  }

  // 長度、高度還沒填過時，不要一開始就顯示紅框
  const touched = {};
  function isBlankRequired(id) {
    return (id === "length" || id === "height") && $(id).value.trim() === "";
  }

  // ---- 計算 ----
  function calculate(v) {
    const levels = ceil(v.height / v.frameHeight);
    const spans = ceil(v.length / v.span);
    const cols = v.closed ? spans : spans + 1;
    const boardLevels = v.boardAllLevels ? levels : Math.min(v.boardLevels, levels);
    const tieCols = ceil(v.length / v.tieH) + (v.closed ? 0 : 1);
    const tieRows = ceil(v.height / v.tieV);
    const k = 1 + v.spare / 100;
    const withSpare = (n) => ceil(n * k);

    const items = [
      { name: "門型架", unit: "座", base: cols * levels,
        how: "列數 " + cols + " × 層數 " + levels },
      { name: "交叉拉桿", unit: "支", base: spans * levels * v.bracesPerSpan,
        how: "跨數 " + spans + " × 層數 " + levels + " × " + v.bracesPerSpan + " 支" },
      { name: "踏板", unit: "片", base: spans * boardLevels * v.boardsPerSpan,
        how: "跨數 " + spans + " × 鋪板層數 " + boardLevels + " × " + v.boardsPerSpan + " 片" },
      { name: "底座", unit: "支", base: cols * 2,
        how: "列數 " + cols + " × 2 支腳" },
      { name: "連接銷", unit: "支", base: cols * 2 * Math.max(levels - 1, 0),
        how: "列數 " + cols + " × 2 × 接合層 " + Math.max(levels - 1, 0) },
      { name: "壁連座", unit: "支", base: tieCols * tieRows,
        how: "水平 " + tieCols + " 點 × 垂直 " + tieRows + " 點" },
    ];
    items.forEach(function (it) { it.qty = withSpare(it.base); });

    return {
      levels: levels,
      spans: spans,
      cols: cols,
      area: v.length * v.height,
      actualHeight: levels * v.frameHeight,
      items: items,
      spare: v.spare,
    };
  }

  // ---- 顯示 ----
  function td(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  let lastResult = null;

  function render() {
    const v = readInputs();
    $("boardLevelsField").hidden = v.boardAllLevels;
    copyMsg.textContent = "";

    const errors = validate(v);
    const blank = isBlankRequired("length") || isBlankRequired("height");
    const shown = errors.filter(function (e) { return !(isBlankRequired(e.id) && !touched[e.id]); });

    if (shown.length) {
      errorEl.textContent = shown.map(function (e) { return e.msg; }).join("；");
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }

    if (errors.length) {
      lastResult = null;
      bodyEl.hidden = true;
      emptyEl.hidden = !(blank && !shown.length);
      return;
    }

    const r = calculate(v);
    lastResult = r;
    emptyEl.hidden = true;
    bodyEl.hidden = false;

    $("sum-levels").textContent = fmt(r.levels) + " 層";
    $("sum-spans").textContent = fmt(r.spans) + " 跨";
    $("sum-cols").textContent = fmt(r.cols) + " 列";
    $("sum-area").textContent = fmt(r.area, 2) + " m²";

    rowsEl.replaceChildren();
    r.items.forEach(function (it) {
      const tr = document.createElement("tr");
      tr.appendChild(td(it.name, "name"));
      const q = td(fmt(it.qty), "num");
      const unit = document.createElement("span");
      unit.className = "unit";
      unit.textContent = it.unit;
      q.appendChild(unit);
      tr.appendChild(q);
      tr.appendChild(td(it.how + (r.spare > 0 ? "，再加備品 " + fmt(r.spare, 2) + "%" : "")));
      tr.lastChild.className = "how";
      rowsEl.appendChild(tr);
    });

    $("height-note").textContent =
      "實際架高約 " + fmt(r.actualHeight, 2) + " 公尺（" + r.levels + " 層 × " + v.frameHeight +
      " 公尺），會略高於或等於輸入的搭設高度。";

    save(v);
  }

  // ---- 複製、列印 ----
  function resultText() {
    const v = readInputs();
    const r = lastResult;
    const lines = [
      "【鷹架數量計算】框式（門型）施工架",
      "外牆總長 " + fmt(v.length, 2) + " m、搭設高度 " + fmt(v.height, 2) + " m（" + (v.closed ? "環繞一圈" : "單面／不封閉") + "）",
      "層數 " + r.levels + "、跨數 " + r.spans + "、門型架列數 " + r.cols + "、立面面積 " + fmt(r.area, 2) + " m²",
      "備品率 " + fmt(v.spare, 2) + "%",
      "",
    ];
    r.items.forEach(function (it) { lines.push(it.name + "：" + fmt(it.qty) + " " + it.unit); });
    lines.push("", "※ 僅供備料估算，未計入轉角、開口、斜撐、護欄、上下設備等。");
    return lines.join("\n");
  }

  $("copy-btn").addEventListener("click", async function () {
    if (!lastResult) return;
    const text = resultText();
    try {
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = "已複製，可以貼到 LINE 或訊息裡。";
    } catch (e) {
      // 舊瀏覽器或非 https 時的備用做法
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      copyMsg.textContent = ok ? "已複製，可以貼到 LINE 或訊息裡。" : "無法自動複製，請改用列印或手動截圖。";
    }
  });

  $("print-btn").addEventListener("click", function () { window.print(); });

  $("reset-spec").addEventListener("click", function () {
    Object.keys(DEFAULT_SPEC).forEach(function (k) { $(k).value = DEFAULT_SPEC[k]; });
    render();
  });

  // ---- 記住上次輸入（只存在這台裝置的瀏覽器） ----
  const SAVE_IDS = ["length", "height", "boardsPerSpan", "boardLevels", "spare",
    "frameHeight", "span", "bracesPerSpan", "tieH", "tieV"];

  function save(v) {
    try {
      const data = { layout: v.closed ? "closed" : "open", boardAllLevels: v.boardAllLevels };
      SAVE_IDS.forEach(function (id) { data[id] = $(id).value; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* 無痕模式等情況存不了，不影響計算 */ }
  }

  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return;
      SAVE_IDS.forEach(function (id) { if (typeof data[id] === "string") $(id).value = data[id]; });
      if (data.layout === "closed" || data.layout === "open") {
        form.querySelector('input[name="layout"][value="' + data.layout + '"]').checked = true;
      }
      if (typeof data.boardAllLevels === "boolean") $("boardAllLevels").checked = data.boardAllLevels;
    } catch (e) { /* 讀不到就用預設值 */ }
  }

  // ---- 綁定事件 ----
  form.addEventListener("input", function (e) {
    if (e.target && e.target.id) touched[e.target.id] = true;
    render();
  });
  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  restore();
  render();
})();
