const STORAGE_KEY = "kuma_config";

const i18n = {
  en: {
    title: "UpKuma Monitor",
    subtitle: "Lightweight status dashboard",
    labelUrl: "Kuma URL",
    labelToken: "API Token (optional)",
    save: "Save config & connect",
    refresh: "Refresh",
    total: "Total",
    up: "Up",
    down: "Down",
    pending: "Pending",
    disconnected: "Disconnected",
    connected: "Connected"
  },
  zh: {
    title: "UpKuma 监控",
    subtitle: "轻量级状态面板",
    labelUrl: "Kuma 地址",
    labelToken: "API Token（可选）",
    save: "保存配置并连接",
    refresh: "刷新",
    total: "总数",
    up: "正常",
    down: "异常",
    pending: "待处理",
    disconnected: "未连接",
    connected: "已连接"
  }
};

const els = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  labelUrl: document.getElementById("labelUrl"),
  labelToken: document.getElementById("labelToken"),
  saveBtn: document.getElementById("saveBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  labelTotal: document.getElementById("labelTotal"),
  labelUp: document.getElementById("labelUp"),
  labelDown: document.getElementById("labelDown"),
  labelPending: document.getElementById("labelPending"),
  statTotal: document.getElementById("statTotal"),
  statUp: document.getElementById("statUp"),
  statDown: document.getElementById("statDown"),
  statPending: document.getElementById("statPending"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot"),
  themeSelect: document.getElementById("themeSelect"),
  langSelect: document.getElementById("langSelect"),
  kumaUrl: document.getElementById("kumaUrl"),
  apiToken: document.getElementById("apiToken")
};

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
  } else {
    root.dataset.theme = theme;
  }
}

function applyLanguage(lang) {
  const t = i18n[lang] || i18n.en;
  els.title.textContent = t.title;
  els.subtitle.textContent = t.subtitle;
  els.labelUrl.textContent = t.labelUrl;
  els.labelToken.textContent = t.labelToken;
  els.saveBtn.textContent = t.save;
  els.refreshBtn.textContent = t.refresh;
  els.labelTotal.textContent = t.total;
  els.labelUp.textContent = t.up;
  els.labelDown.textContent = t.down;
  els.labelPending.textContent = t.pending;
  els.statusText.textContent = t.disconnected;
}

function setConnected(isConnected, lang) {
  const t = i18n[lang] || i18n.en;
  els.statusText.textContent = isConnected ? t.connected : t.disconnected;
  document.querySelector(".footer").classList.toggle("connected", isConnected);
}

async function loadConfig() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const config = data[STORAGE_KEY] || { lang: "zh", theme: "dark" };
  els.langSelect.value = config.lang || "zh";
  els.themeSelect.value = config.theme || "dark";
  els.kumaUrl.value = config.url || "";
  els.apiToken.value = config.token || "";
  applyTheme(config.theme || "dark");
  applyLanguage(config.lang || "zh");
  setConnected(false, config.lang || "zh");
}

function parseKumaMetrics(metricsText) {
  let up = 0;
  let down = 0;
  let pending = 0;

  const lines = metricsText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("monitor_status{")) continue;
    const valueStr = line.trim().split(" ").pop();
    const value = Number(valueStr);
    if (value === 1) up++;
    else if (value === 0) down++;
    else if (value === 2) pending++;
  }

  return { total: up + down + pending, up, down, pending };
}

async function fetchMetrics(config) {
  if (!config.url) throw new Error("Missing URL");
  const endpoint = config.url.replace(/\/$/, "") + "/metrics";
  const headers = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  const resp = await fetch(endpoint, { headers });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  return parseKumaMetrics(text);
}

function updateStats(stats) {
  els.statTotal.textContent = String(stats.total);
  els.statUp.textContent = String(stats.up);
  els.statDown.textContent = String(stats.down);
  els.statPending.textContent = String(stats.pending);
}

async function saveConfig() {
  const config = {
    lang: els.langSelect.value,
    theme: els.themeSelect.value,
    url: els.kumaUrl.value.trim(),
    token: els.apiToken.value.trim()
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  applyTheme(config.theme);
  applyLanguage(config.lang);
  setConnected(Boolean(config.url), config.lang);
  return config;
}

els.themeSelect.addEventListener("change", async () => {
  applyTheme(els.themeSelect.value);
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const config = data[STORAGE_KEY] || {};
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...config, theme: els.themeSelect.value } });
});

els.langSelect.addEventListener("change", async () => {
  applyLanguage(els.langSelect.value);
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const config = data[STORAGE_KEY] || {};
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...config, lang: els.langSelect.value } });
});

els.saveBtn.addEventListener("click", async () => {
  const config = await saveConfig();
  try {
    const stats = await fetchMetrics(config);
    updateStats(stats);
    setConnected(true, config.lang);
  } catch (err) {
    console.error(err);
    setConnected(false, config.lang);
  }
});

els.refreshBtn.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const config = data[STORAGE_KEY] || {};
  try {
    const stats = await fetchMetrics(config);
    updateStats(stats);
    setConnected(true, config.lang || "zh");
  } catch (err) {
    console.error(err);
    setConnected(false, config.lang || "zh");
  }
});

(async () => {
  await loadConfig();
})();
