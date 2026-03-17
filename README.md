# Future Crop AI

## Quick Start (Local)
```bash
cd backend1 && source venv/bin/activate && uvicorn app:app --reload --port 8010
open frontend/index.html
```

## Cloudflare Hosted API
https://evaluated-neil-deferred-likes.trycloudflare.com

## Deploy Frontend to Cloudflare Pages
1. dash.cloudflare.com → Pages → Connect GitHub (FutureCropAI)
2. Root dir: `/frontend`
3. Deploy!

## Structure
- `frontend/` - UI (HTML/CSS/JS)
- `backend1/` - FastAPI backend + data/models
- `models/` - Price prediction models
- `deta_backend/` - Alternative deploy


