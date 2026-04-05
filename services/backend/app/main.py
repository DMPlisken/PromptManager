from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import groups, variables, templates, executions, tasks, images, tags, task_images, export_import

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
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(task_images.router, prefix="/api/task-images", tags=["task-images"])
app.include_router(export_import.router, prefix="/api/groups", tags=["export-import"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
