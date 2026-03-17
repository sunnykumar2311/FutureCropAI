import os
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# ----- Paths ---------------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
CSV_PATH = os.path.join(BASE_DIR, "crop_recommendation.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")

# ----- 1. Load dataset -----------------------------------------------
print(f"📂 Loading data from: {CSV_PATH}")

if not os.path.exists(CSV_PATH):
    raise FileNotFoundError(
        f"crop_recommendation.csv not found at {CSV_PATH}. "
        "Download it from the GitHub repo and put it in backend1/crop_reco/."
    )

df = pd.read_csv(CSV_PATH)

# Typical columns in this dataset:
# ['N','P','K','temperature','humidity','ph','rainfall','label']
if "label" not in df.columns:
    raise ValueError("Expected column 'label' (crop name) not found in CSV.")

X = df.drop("label", axis=1)
y = df["label"]

feature_names = list(X.columns)
print("✅ Features:", feature_names)
print("✅ Classes:", sorted(y.unique())[:10], "...")

# ----- 2. Split train / test ----------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# ----- 3. Build pipeline (Scaler + RandomForest) ---------------------
pipeline = Pipeline(steps=[
    ("scaler", StandardScaler()),
    ("rf", RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=42,
        n_jobs=-1
    ))
])

print("🚀 Training RandomForest crop recommendation model...")
pipeline.fit(X_train, y_train)

train_acc = pipeline.score(X_train, y_train)
test_acc = pipeline.score(X_test, y_test)
print(f"✅ Train accuracy: {train_acc:.4f}")
print(f"✅ Test  accuracy: {test_acc:.4f}")

# ----- 4. Save model bundle to model.pkl -----------------------------
bundle = {
    "model": pipeline,
    "features": feature_names,
}

os.makedirs(BASE_DIR, exist_ok=True)
joblib.dump(bundle, MODEL_PATH)
print(f"💾 Saved trained model to: {MODEL_PATH}")