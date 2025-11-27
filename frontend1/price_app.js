/* Future Crop AI — JS with SELECT-based State & Market */
const API_BASE = "http://127.0.0.1:8010";

const $ = (id) => document.getElementById(id);

// DOM
const apiStatus  = $("apiStatus");
const commodity  = $("commodity");
const stateSel   = $("state");
const marketSel  = $("market");
const dateInp    = $("predDate");
const modelCount = $("modelCount");
const predictBtn = $("predictBtn");
const clearBtn   = $("clearBtn");
const resBox     = $("result");
const winPill    = $("windowSize");
const usedPill   = $("usedPoints");
const padPill    = $("paddedFlag");
const toaster    = $("toaster");
const chartNote  = $("chartNote");

function toast(msg, bad=false) {
  const n = document.createElement("div");
  n.className = `toast ${bad ? "bad": ""}`;
  n.textContent = msg;
  toaster.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(data?.detail || txt || "Request failed");
  return data;
}

function setDisabled(sel, disabled, placeholder) {
  sel.disabled = disabled;
  if (placeholder !== undefined) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
  }
}

function fillSelect(sel, items, firstText="Select…") {
  sel.innerHTML = `<option value="">${firstText}</option>` +
    items.map(v => `<option>${v}</option>`).join("");
  sel.disabled = items.length === 0;
}

async function init() {
  dateInp.value = new Date().toISOString().slice(0,10);

  // health
  try {
    await apiGet("/health");
    apiStatus.className = "status-pill status-ok";
    apiStatus.textContent = "API: on";
  } catch {
    apiStatus.className = "status-pill status-bad";
    apiStatus.textContent = "API: off";
    toast("Backend not reachable. Run: python -m uvicorn app:app --reload --port 8010", true);
  }

  // models -> commodity select
  try {
    const m = await apiGet("/models");
    const list = m.models || [];
    commodity.innerHTML = `<option value="">Select a commodity…</option>` + list.map(c=>`<option>${c}</option>`).join("");
    modelCount.textContent = `${m.count || list.length} models available`;
  } catch {
    commodity.innerHTML = `<option value="">(no models found)</option>`;
    modelCount.textContent = "";
  }

  // disable state/market initially
  setDisabled(stateSel, true, "Select commodity first…");
  setDisabled(marketSel, true, "Select state first…");

  setupChart();
}
window.addEventListener("DOMContentLoaded", init);

// cascading: commodity -> states
commodity.addEventListener("change", async () => {
  const c = commodity.value.trim();
  setDisabled(marketSel, true, "Select state first…");
  if (!c) { setDisabled(stateSel, true, "Select commodity first…"); return; }

  setDisabled(stateSel, true, "Loading states…");
  try {
    const res = await apiGet(`/states?commodity=${encodeURIComponent(c)}`);
    fillSelect(stateSel, res.states || [], "Select a state…");
  } catch {
    setDisabled(stateSel, true, "States unavailable");
    toast("Could not load states for this commodity.", true);
  }
});

// cascading: state -> markets
stateSel.addEventListener("change", async () => {
  const c = commodity.value.trim();
  const s = stateSel.value.trim();
  setDisabled(marketSel, true, "Loading markets…");
  if (!c || !s) { setDisabled(marketSel, true, "Select state first…"); return; }

  try {
    const res = await apiGet(`/markets?commodity=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`);
    fillSelect(marketSel, res.markets || [], "Select a market…");
  } catch {
    setDisabled(marketSel, true, "Markets unavailable");
    toast("Could not load markets for that state.", true);
  }
});

function validate() {
  const c = commodity.value.trim();
  const s = stateSel.value.trim();
  const m = marketSel.value.trim();
  let d = (dateInp.value || "").trim();

  if (!c) { toast("Select a commodity.", true); return null; }
  if (!s) { toast("Select a state.", true); return null; }
  if (!m) { toast("Select a market.", true); return null; }
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    toast("Invalid date format. Use YYYY-MM-DD.", true); return null;
  }
  if (!d) d = undefined;
  return { commodity: c, state: s, market: m, date: d };
}

predictBtn.addEventListener("click", async () => {
  const q = validate();
  if (!q) return;

  predictBtn.disabled = true;
  resBox.classList.add("hide"); resBox.textContent = "";
  winPill.textContent = "win: —"; usedPill.textContent = "used: —"; padPill.textContent = "padded: —";
  chartNote.textContent = ""; resetChart();

  try {
    const resp = await apiPost("/predict_by_context", q);
    winPill.textContent  = `win: ${resp.window_size ?? "—"}`;
    usedPill.textContent = `used: ${resp.used_points ?? "—"}`;
    padPill.textContent  = `padded: ${resp.padded ? "yes" : "no"}`;
    const priceIN = Number(resp.predicted_next_price || 0).toLocaleString("en-IN");
    resBox.textContent = `Predicted next price: ₹ ${priceIN}`;
    resBox.classList.remove("hide");
    await drawSeries(q, resp);
  } catch (e) {
    toast(`Prediction failed: ${e.message}`, true);
    chartNote.textContent = "Chart not updated.";
  } finally {
    predictBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  commodity.value = "";
  setDisabled(stateSel, true, "Select commodity first…");
  setDisabled(marketSel, true, "Select state first…");
  resBox.classList.add("hide");
  winPill.textContent = "win: —"; usedPill.textContent = "used: —"; padPill.textContent = "padded: —";
  chartNote.textContent = ""; resetChart();
});

// Chart.js
let chart;
function setupChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Recent Prices", data: [], tension: 0.25, borderWidth: 2, pointRadius: 2 },
      { label: "Predicted Next", data: [], tension: 0, borderWidth: 2, pointRadius: 4 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 450 },
      interaction: { mode: "index", intersect: false },
      scales: { x: { title: { display: true, text: "Date" }},
               y: { title: { display: true, text: "Modal Price (₹)" }, beginAtZero: false } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}
function resetChart(){ if(!chart)return; chart.data.labels=[]; chart.data.datasets[0].data=[]; chart.data.datasets[1].data=[]; chart.update(); }

function seriesEndpoint(q){
  const p = new URLSearchParams({ commodity:q.commodity, state:q.state, market:q.market });
  if (q.date) p.set("date", q.date);
  return `${API_BASE}/series_by_context?${p.toString()}`;
}
async function drawSeries(q, resp){
  try{
    const r = await fetch(seriesEndpoint(q));
    if(!r.ok) throw new Error();
    const hist = await r.json();
    const labels = hist.dates.slice();
    const data   = hist.prices.slice();
    labels.push(q.date || new Date().toISOString().slice(0,10));
    data.push(resp.predicted_next_price);
    chart.data.labels = labels;
    chart.data.datasets[0].data = hist.prices;
    chart.data.datasets[1].data = new Array(hist.prices.length - 1).fill(null).concat([resp.predicted_next_price]);
    chart.update();
    chartNote.textContent = "";
  }catch{
    const d = q.date || new Date().toISOString().slice(0,10);
    chart.data.labels = [d];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [resp.predicted_next_price];
    chart.update();
    chartNote.textContent = "History endpoint not available; showing predicted point only.";
  }
}