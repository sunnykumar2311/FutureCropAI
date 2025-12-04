// script.js

// Global API base URL for all pages
const API_BASE = "https://futurecropai.onrender.com";

// (optional) helper functions if you want to reuse them

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

// Now you can call apiPost("/predict_by_context", payload)
// or apiPost("/crop/recommend", payload) from other scripts.