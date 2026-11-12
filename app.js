// 報修登記：前端程式
// 只做兩件事：新增一筆報修、顯示最近 20 筆。
// 不送 status（由資料庫預設為「待處理」），也不做修改或刪除。
(function () {
  "use strict";

  const TABLE = "repair_requests";
  const LIST_LIMIT = 20;

  const form = document.getElementById("repair-form");
  const submitBtn = document.getElementById("submit-btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const messageEl = document.getElementById("message");
  const listEl = document.getElementById("repair-list");
  const listStatusEl = document.getElementById("list-status");
  const descEl = document.getElementById("description");
  const descCountEl = document.getElementById("desc-count");

  // ---- 顯示訊息 ----
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + (type === "ok" ? "ok" : "err");
    messageEl.hidden = false;
    messageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideMessage() {
    messageEl.hidden = true;
  }

  // ---- 檢查設定 ----
  const cfg = window.APP_CONFIG || {};
  const url = (cfg.SUPABASE_URL || "").trim();
  const key = (cfg.SUPABASE_PUBLISHABLE_KEY || "").trim();
  const configOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 0;

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    disableAll("無法載入 Supabase 程式庫，請檢查網路連線後重新整理頁面。");
    return;
  }
  if (!configOk) {
    disableAll("系統尚未設定完成（config.js 的 Supabase 網址或金鑰不正確），暫時無法使用。");
    return;
  }
  if (/^sb_secret_/i.test(key)) {
    disableAll("config.js 裡放的是 secret 金鑰，這不能公開！請立刻改成 publishable key，並到 Supabase 後台作廢這把 secret 金鑰。");
    return;
  }

  const client = window.supabase.createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function disableAll(text) {
    showMessage(text, "err");
    submitBtn.disabled = true;
    refreshBtn.disabled = true;
    listStatusEl.textContent = "無法載入清單。";
    listStatusEl.classList.add("err");
  }

  // ---- 字數計數 ----
  descEl.addEventListener("input", function () {
    descCountEl.textContent = String(descEl.value.length);
  });

  // ---- 表單檢查（與資料庫 CHECK 規則一致） ----
  const RULES = [
    { id: "reporter_name", label: "報修人", max: 50 },
    { id: "location", label: "地點或部門", max: 100 },
    { id: "category", label: "類別", max: null, options: ["設備", "網路", "環境", "其他"] },
    { id: "description", label: "問題說明", max: 1000 },
  ];

  function readForm() {
    const data = {};
    const errors = [];
    RULES.forEach(function (rule) {
      const el = document.getElementById(rule.id);
      const value = (el.value || "").trim();
      el.classList.remove("invalid");
      if (!value) {
        errors.push("請填寫「" + rule.label + "」");
        el.classList.add("invalid");
      } else if (rule.max && value.length > rule.max) {
        errors.push("「" + rule.label + "」最多 " + rule.max + " 字");
        el.classList.add("invalid");
      } else if (rule.options && rule.options.indexOf(value) === -1) {
        errors.push("「" + rule.label + "」選項不正確");
        el.classList.add("invalid");
      }
      data[rule.id] = value;
    });
    const urgencyEl = form.querySelector('input[name="urgency"]:checked');
    const urgency = urgencyEl ? urgencyEl.value : "中";
    if (["低", "中", "高"].indexOf(urgency) === -1) errors.push("「緊急程度」選項不正確");
    data.urgency = urgency;
    return { data: data, errors: errors };
  }

  // ---- 把資料庫錯誤翻成看得懂的話 ----
  function friendlyError(error) {
    const msg = (error && error.message) || "";
    const code = (error && error.code) || "";
    if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
      return "沒有權限寫入資料，請聯絡系統管理員確認資料庫權限設定。";
    }
    if (code === "23514" || /check constraint/i.test(msg)) {
      return "資料格式不符合規定（例如字數太多或選項不正確），請檢查後再送出。";
    }
    if (/Failed to fetch|NetworkError|network/i.test(msg)) {
      return "網路連線失敗，請確認網路後再試一次。";
    }
    return "送出失敗：" + (msg || "未知錯誤") + "。請稍後再試。";
  }

  // ---- 送出 ----
  let sending = false;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (sending) return;
    hideMessage();

    const result = readForm();
    if (result.errors.length) {
      showMessage(result.errors.join("；"), "err");
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "送出中…";
    try {
      // 只送這 5 個欄位；不送 status、id、created_at
      const { error } = await client.from(TABLE).insert({
        reporter_name: result.data.reporter_name,
        location: result.data.location,
        category: result.data.category,
        description: result.data.description,
        urgency: result.data.urgency,
      });
      if (error) {
        showMessage(friendlyError(error), "err");
        return;
      }
      showMessage("報修已送出，謝謝！狀態為「待處理」。", "ok");
      form.reset();
      descCountEl.textContent = "0";
      loadList();
    } catch (err) {
      showMessage(friendlyError(err), "err");
    } finally {
      sending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "送出報修";
    }
  });

  // ---- 清單 ----
  const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // 用 textContent，避免有人輸入惡意 HTML
    return node;
  }

  function renderList(rows) {
    listEl.replaceChildren();
    if (!rows.length) {
      listStatusEl.textContent = "目前還沒有報修資料。";
      listStatusEl.hidden = false;
      return;
    }
    listStatusEl.hidden = true;
    rows.forEach(function (row) {
      const li = el("li", "repair-item");
      const top = el("div", "item-top");
      top.appendChild(el("span", "tag", row.category));
      top.appendChild(el("span", "tag urg-" + row.urgency, "緊急程度：" + row.urgency));
      top.appendChild(el("span", "tag status", row.status));
      li.appendChild(top);
      li.appendChild(el("p", "item-desc", row.description));
      const when = row.created_at ? timeFormatter.format(new Date(row.created_at)) : "";
      li.appendChild(el("div", "item-meta", row.reporter_name + "・" + row.location + "・" + when));
      listEl.appendChild(li);
    });
  }

  async function loadList() {
    refreshBtn.disabled = true;
    listStatusEl.classList.remove("err");
    listStatusEl.textContent = "載入中…";
    listStatusEl.hidden = false;
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("id, created_at, reporter_name, location, category, description, urgency, status")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw error;
      renderList(data || []);
    } catch (err) {
      listEl.replaceChildren();
      listStatusEl.textContent = "清單載入失敗：" + ((err && err.message) || "未知錯誤");
      listStatusEl.classList.add("err");
      listStatusEl.hidden = false;
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener("click", loadList);
  loadList();
})();
