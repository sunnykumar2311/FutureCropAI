// frontend1/price_app.js

const API_BASE = "http://127.0.0.1:8010";

let priceChart = null;

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.borderColor = isError ? "#c62828" : "#4caf50";
  toast.classList.remove("toast--hidden");
  toast.classList.add("toast--show");
  setTimeout(() => {
    toast.classList.remove("toast--show");
    toast.classList.add("toast--hidden");
  }, 3000);
}

function setApiStatus(status, msg) {
  const el = document.getElementById("apiStatus");
  if (!el) return;
  el.textContent = `API: ${msg}`;
  el.classList.remove("api-status--ok", "api-status--error", "api-status--checking");
  el.classList.add(status);
}

async function fetchJSON(url, options = {}) {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function initPage() {
  // API health
  try {
    setApiStatus("api-status--checking", "checking…");
    const h = await fetchJSON(`${API_BASE}/health`);
    if (!h.ok) throw new Error("health not ok");
    setApiStatus("api-status--ok", "Online");
  } catch (e) {
    setApiStatus("api-status--error", "Offline");
    showToast("API seems offline. Check backend (uvicorn) on port 8010.", true);
  }

  // Populate commodities
  const commoditySelect = document.getElementById("pp-commodity");
  const modelInfo = document.getElementById("pp-modelInfo");

  try {
    const data = await fetchJSON(`${API_BASE}/models`);
    commoditySelect.innerHTML = `<option value="">Select commodity…</option>`;
    (data.models || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      commoditySelect.appendChild(opt);
    });
    modelInfo.textContent = `${data.count || 0} models available`;
  } catch (e) {
    commoditySelect.innerHTML = `<option value="">Could not load models</option>`;
    showToast("Failed to load commodity list.", true);
  }

  // Hook handlers
  commoditySelect.addEventListener("change", onCommodityChange);
  document.getElementById("pp-state").addEventListener("change", onStateChange);
  document.getElementById("pp-predictBtn").addEventListener("click", onPredictClick);
  document.getElementById("pp-plotBtn").addEventListener("click", onPlotClick);
  document.getElementById("pp-clearBtn").addEventListener("click", clearForm);
}

async function onCommodityChange() {
  const commodity = document.getElementById("pp-commodity").value;
  const stateSel = document.getElementById("pp-state");
  const marketSel = document.getElementById("pp-market");

  stateSel.innerHTML = `<option value="">Loading states…</option>`;
  stateSel.disabled = true;
  marketSel.innerHTML = `<option value="">Select state first…</option>`;
  marketSel.disabled = true;

  if (!commodity) {
    stateSel.innerHTML = `<option value="">Select commodity first…</option>`;
    return;
  }

  try {
    const data = await fetchJSON(
      `${API_BASE}/states?commodity=${encodeURIComponent(commodity)}`
    );
    const states = data.states || [];
    if (states.length === 0) {
      stateSel.innerHTML = `<option value="">No states found</option>`;
      showToast("No states found for this commodity in DB.", true);
      return;
    }
    stateSel.disabled = false;
    stateSel.innerHTML = `<option value="">Select state…</option>`;
    states.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      stateSel.appendChild(opt);
    });
  } catch (e) {
    stateSel.innerHTML = `<option value="">Error loading states</option>`;
    showToast("Failed to load states.", true);
  }
}

async function onStateChange() {
  const commodity = document.getElementById("pp-commodity").value;
  const state = document.getElementById("pp-state").value;
  const marketSel = document.getElementById("pp-market");

  marketSel.innerHTML = `<option value="">Loading markets…</option>`;
  marketSel.disabled = true;

  if (!commodity || !state) {
    marketSel.innerHTML = `<option value="">Select state first…</option>`;
    return;
  }

  try {
    const data = await fetchJSON(
      `${API_BASE}/markets?commodity=${encodeURIComponent(
        commodity
      )}&state=${encodeURIComponent(state)}`
    );
    const markets = data.markets || [];
    if (markets.length === 0) {
      marketSel.innerHTML = `<option value="">No markets found</option>`;
      showToast("No markets found for this state.", true);
      return;
    }
    marketSel.disabled = false;
    marketSel.innerHTML = `<option value="">Select market…</option>`;
    markets.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      marketSel.appendChild(opt);
    });
  } catch (e) {
    marketSel.innerHTML = `<option value="">Error loading markets</option>`;
    showToast("Failed to load markets.", true);
  }
}

function validateContext() {
  const commodityEl = document.getElementById("pp-commodity");
  const stateEl = document.getElementById("pp-state");
  const marketEl = document.getElementById("pp-market");
  let ok = true;

  [commodityEl, stateEl, marketEl].forEach((el) =>
    el.classList.remove("input--error")
  );

  if (!commodityEl.value) {
    ok = false;
    commodityEl.classList.add("input--error");
  }
  if (!stateEl.value) {
    ok = false;
    stateEl.classList.add("input--error");
  }
  if (!marketEl.value) {
    ok = false;
    marketEl.classList.add("input--error");
  }

  if (!ok) {
    alert("Please select commodity, state and market before predicting.");
  }
  return ok;
}

async function onPlotClick() {
  if (!validateContext()) return;
  await loadHistory(true);
}

async function onPredictClick() {
  if (!validateContext()) return;
  await loadHistory(false);
  await doPrediction();
}

function updateWindowChips(win, used, padded) {
  document.getElementById("chip-win").textContent = `win: ${win}`;
  document.getElementById("chip-used").textContent = `used: ${used}`;
  document.getElementById("chip-pad").textContent = `padded: ${padded ? "yes" : "no"}`;
}

async function loadHistory(plotOnly = false) {
  const commodity = document.getElementById("pp-commodity").value;
  const state = document.getElementById("pp-state").value;
  const market = document.getElementById("pp-market").value;
  const date = document.getElementById("pp-date").value;

  const q = new URLSearchParams({
    commodity,
    state,
    market,
    limit: "30",
  });
  if (date) {
    q.set("date", date);
  }

  try {
    const data = await fetchJSON(`${API_BASE}/series_by_context?` + q.toString());
    renderChart(data.dates || [], data.prices || []);
    if (plotOnly) {
      updateWindowChips("—", data.prices.length, false);
      document.getElementById("pp-predictionText").innerHTML =
        "History plotted. Click <strong>Predict Price</strong> to estimate next price.";
    }
  } catch (e) {
    showToast("Could not load history. Maybe DB has no data for this context.", true);
  }
}

async function doPrediction() {
  const commodity = document.getElementById("pp-commodity").value;
  const state = document.getElementById("pp-state").value;
  const market = document.getElementById("pp-market").value;
  const date = document.getElementById("pp-date").value;

  let payload = { commodity, state, market };
  if (date) payload.date = date;

  try {
    const out = await fetchJSON(`${API_BASE}/predict_by_context`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    updateWindowChips(out.window_size, out.used_points, out.padded);

    const text = `Predicted next-day modal price for <strong>${commodity}</strong> in <strong>${market}, ${state}</strong> is <strong>₹ ${out.predicted_next_price}</strong>.`;
    document.getElementById("pp-predictionText").innerHTML = text;

    // Also mark last point on chart if chart already exists
    if (priceChart && priceChart.data.labels.length > 0) {
      const labels = priceChart.data.labels.slice();
      const hist = priceChart.data.datasets[0].data.slice();
      const lastDate = labels[labels.length - 1] || "Next";
      const nextLabel = date || "Next day";
      if (priceChart.data.datasets.length < 2) {
        priceChart.data.datasets.push({
          label: "Predicted Next",
          data: new Array(hist.length - 1).fill(null).concat(out.predicted_next_price),
          borderColor: "#e53935",
          backgroundColor: "rgba(229,57,53,0.3)",
          tension: 0.25,
        });
      } else {
        const idx = hist.length - 1;
        const ds = priceChart.data.datasets[1];
        ds.data = new Array(hist.length - 1).fill(null).concat(out.predicted_next_price);
      }
      priceChart.update();
    }

    showToast("Prediction successful.");
  } catch (e) {
    alert("Prediction failed: " + e.message);
  }
}

function renderChart(labels, values) {
  const ctx = document.getElementById("pp-chart");
  if (!ctx) return;

  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Recent Prices",
          data: values,
          tension: 0.25,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true },
        },
        y: {
          title: { display: true, text: "Modal Price (₹)" },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Clear form
function clearForm() {
  document.getElementById("pp-commodity").selectedIndex = 0;
  document.getElementById("pp-state").innerHTML =
    '<option value="">Select commodity first…</option>';
  document.getElementById("pp-state").disabled = true;
  document.getElementById("pp-market").innerHTML =
    '<option value="">Select state first…</option>';
  document.getElementById("pp-market").disabled = true;
  document.getElementById("pp-date").value = "";
  updateWindowChips("—", "—", "—");
  document.getElementById("pp-predictionText").innerHTML =
    "No prediction yet. Fill the form and click <strong>Predict Price</strong>.";
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }
}

// Init on DOM ready
document.addEventListener("DOMContentLoaded", initPage);
