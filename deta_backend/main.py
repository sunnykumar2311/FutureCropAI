import os
import joblib
import numpy as np
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "crop_model.pkl")

# Load crop model safely
crop_model = None
crop_model_loaded = False
CROP_FEATURES = []

try:
    model_bundle = joblib.load(MODEL_PATH)
    if isinstance(model_bundle, dict):
        crop_model = model_bundle["model"]
        CROP_FEATURES = model_bundle.get("features", [])
    else:
        crop_model = model_bundle
    crop_model_loaded = True
    print(f"✅ Crop model loaded from {MODEL_PATH}")
    print(f"   Features: {CROP_FEATURES}")
except Exception as e:
    crop_model = None
    CROP_FEATURES = []
    crop_model_loaded = False
    print(f"❌ Error loading crop model from {MODEL_PATH}: {e}")

# App
app = FastAPI(title="Future Crop Backend", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CropIn(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float

@app.get("/health")
def health():
    return {
        "ok": True,
        "crop_model_loaded": crop_model_loaded
    }

@app.get("/models")
def models():
    # Stub for compatibility - crop models not price-specific
    return { "models": [] , "count": 0 }

@app.post("/crop/recommend")
def recommend_crop(inp: CropIn):
    if not crop_model_loaded:
        raise HTTPException(status_code=500, detail="Crop model not loaded. Check /health")
    
    feat_dict = {
        "N": inp.N,
        "P": inp.P,
        "K": inp.K,
        "temperature": inp.temperature,
        "humidity": inp.humidity,
        "ph": inp.ph,
        "rainfall": inp.rainfall,
    }
    
    try:
        row = [feat_dict[name] for name in CROP_FEATURES]
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Missing feature {e}")
    
    X = np.array([row], dtype=float)
    
    try:
        probs = crop_model.predict_proba(X)[0]
        classes = crop_model.classes_
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
    
    order = np.argsort(probs)[::-1]
    best_idx = int(order[0])
    best_crop = str(classes[best_idx])
    best_prob = float(probs[best_idx])
    
    alternatives = []
    for idx in order[1:4]:
        alternatives.append({
            "crop": str(classes[int(idx)]),
            "confidence": round(float(probs[int(idx)]) * 100.0, 1)
        })
    
    suitability = "Excellent" if best_prob >= 0.75 else "Good" if best_prob >= 0.55 else "Fair" if best_prob >= 0.4 else "Low"
    growth_score = round(best_prob * 10.0, 1)
    
    return {
        "recommended_crop": best_crop,
        "confidence": round(best_prob * 100.0, 1),
        "suitability": suitability,
        "growth_score": growth_score,
        "alternatives": alternatives,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
