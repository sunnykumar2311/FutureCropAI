# Fix Render Deployment: Ensure Crop Model Loads in Production

## Plan Summary
- Create `backend/models/crop_model.pkl` (copy from `crop_reco/model.pkl`)
- Edit `.gitignore` (unignore *.pkl/*.joblib)
- Edit `backend/app.py` (update CROP_MODEL_PATH to \"models/crop_model.pkl\")
- Git add/commit/push
- Verify on Render: https://futurecropai-1.onrender.com/health

## Steps (to be checked off)

### 1. [✅] Create backend/models/ and copy model
### 2. [✅] Edit .gitignore 
### 3. [✅] Edit backend/app.py 
### 4. [ ] Git status & add/commit/push
### 5. [ ] Verify deployment

**Next:** Proceed to Step 1.
