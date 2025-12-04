// frontend1/crop_app.js

const API_BASE = "http://127.0.0.1:8010";

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

function getNumber(id, min, max) {
  const el = document.getElementById(id);
  el.classList.remove("input--error");
  const raw = el.value.trim();
  if (raw === "") {
    el.classList.add("input--error");
    throw new Error(`Please enter a value for ${id}.`);
  }
  const v = Number(raw);
  if (Number.isNaN(v)) {
    el.classList.add("input--error");
    throw new Error(`${id} must be a number.`);
  }
  if (v < min || v > max) {
    el.classList.add("input--error");
    throw new Error(`${id} should be between ${min} and ${max}.`);
  }
  return v;
}

async function onRecommendClick() {
  try {
    const N = getNumber("N", 0, 200);
    const P = getNumber("P", 0, 200);
    const K = getNumber("K", 0, 300);
    const temperature = getNumber("temperature", -10, 60);
    const humidity = getNumber("humidity", 0, 100);
    const ph = getNumber("ph", 0, 14);
    const rainfall = getNumber("rainfall", 0, 500);

    const payload = {
      N,
      P,
      K,
      temperature,
      humidity,
      ph,
      rainfall,
    };

    const resp = await fetch(`${API_BASE}/crop/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    renderResult(data, payload);
    showToast("Crop recommendation generated.");
  } catch (e) {
    alert(e.message);
  }
}

function renderResult(data, input) {
  const main = document.getElementById("cr-mainResult");
  const metrics = document.getElementById("cr-metrics");
  const altBox = document.getElementById("cr-alternatives");

  const rec = data.recommended_crop || "Unknown crop";

  main.innerHTML = `
    <p class="recommended">
      Recommended crop: <span>${rec}</span>
    </p>
    <p class="muted">
      This is based on your soil nutrients and climate parameters.
    </p>
  `;

  // Metrics
  metrics.classList.remove("hidden");
  document.getElementById("cr-confidence").textContent =
    (data.confidence != null ? data.confidence.toFixed(1) + "%" : "—");
  document.getElementById("cr-suitability").textContent =
    data.suitability || "—";
  document.getElementById("cr-growth").textContent =
    data.growth_score != null ? data.growth_score.toFixed(1) + "/10" : "—";
  document.getElementById("cr-risk").textContent = data.risk_label || "—";

  // Alternatives
  const altList = document.getElementById("cr-altList");
  altList.innerHTML = "";
  if (Array.isArray(data.alternatives) && data.alternatives.length > 0) {
    altBox.classList.remove("hidden");
    data.alternatives.forEach((a) => {
      const li = document.createElement("li");
      const conf =
        a.confidence != null ? `${a.confidence.toFixed(1)}% confidence` : "";
      li.textContent = `${a.crop} ${conf}`;
      altList.appendChild(li);
    });
  } else {
    altBox.classList.add("hidden");
  }

  // Snapshot
  document.getElementById(
    "cr-inputSummary"
  ).textContent = `N=${input.N}, P=${input.P}, K=${input.K}, Temp=${input.temperature}°C, Humidity=${input.humidity}%, pH=${input.ph}, Rainfall=${input.rainfall}mm.`;
}

function clearForm() {
  ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"].forEach((id) => {
    const el = document.getElementById(id);
    el.value = "";
    el.classList.remove("input--error");
  });
  document.getElementById("cr-mainResult").innerHTML =
    '<p class="placeholder">Results will appear here after you click <strong>Recommend Crop</strong>.</p>';
  document.getElementById("cr-metrics").classList.add("hidden");
  document.getElementById("cr-alternatives").classList.add("hidden");
  document.getElementById("cr-inputSummary").textContent = "—";
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("cr-recoBtn")
    .addEventListener("click", onRecommendClick);
  document.getElementById("cr-clearBtn").addEventListener("click", clearForm);
});
