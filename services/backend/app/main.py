from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import groups, variables, templates, executions

app = FastAPI(title="PromptManager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(variables.router, prefix="/api/variables", tags=["variables"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(executions.router, prefix="/api/executions", tags=["executions"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
