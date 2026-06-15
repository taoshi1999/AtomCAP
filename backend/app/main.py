"""AtomCAP 后端入口。"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.conversations import router as conversations_router
from app.api.deals import router as deals_router
from app.api.deliverables import router as deliverables_router
from app.api.preferences import router as preferences_router

app = FastAPI(title="AtomCAP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(conversations_router, prefix="/api/conversations", tags=["conversations"])
app.include_router(deals_router, prefix="/api/deals", tags=["deals"])
app.include_router(deliverables_router, prefix="/api/deliverables", tags=["deliverables"])
app.include_router(preferences_router, prefix="/api/preferences", tags=["preferences"])


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
