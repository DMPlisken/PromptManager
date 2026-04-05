import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task_template_image import TaskTemplateImage
from app.services.image_storage import save_upload, delete_single_image, UPLOAD_DIR, MAX_SIZE, ALLOWED_TYPES

router = APIRouter()


@router.post("/upload", status_code=201)
async def upload_task_image(
    file: UploadFile = File(...),
    task_id: int = Form(...),
    template_id: int = Form(...),
    file_path: str = Form(...),
    display_order: int = Form(0),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image file and associate with a task-template, storing both local path and server file."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, f"File too large (max {MAX_SIZE // 1024 // 1024}MB)")

    # Store in task-specific directory
    store_dir = os.path.join(UPLOAD_DIR, "tasks", str(task_id))
    os.makedirs(store_dir, exist_ok=True)
    import uuid
    ext = os.path.splitext(file.filename or "image.png")[1].lower() or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(store_dir, filename)
    import aiofiles
    async with aiofiles.open(full_path, "wb") as f:
        await f.write(content)
    stored_path = f"tasks/{task_id}/{filename}"

    img = TaskTemplateImage(
        task_id=task_id, template_id=template_id,
        file_path=file_path, stored_path=stored_path,
        original_name=file.filename or "image.png",
        file_size=len(content), mime_type=file.content_type,
        display_order=display_order,
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return {
        "id": img.id, "task_id": img.task_id, "template_id": img.template_id,
        "file_path": img.file_path, "original_name": img.original_name,
        "file_size": img.file_size, "display_order": img.display_order,
        "thumbnail_url": f"/api/task-images/file/{stored_path}",
    }


@router.get("/task/{task_id}/template/{template_id}")
async def list_task_template_images(task_id: int, template_id: int, db: AsyncSession = Depends(get_db)):
    """List all images for a task-template pair."""
    result = await db.execute(
        select(TaskTemplateImage)
        .where(TaskTemplateImage.task_id == task_id, TaskTemplateImage.template_id == template_id)
        .order_by(TaskTemplateImage.display_order)
    )
    images = result.scalars().all()
    return [{
        "id": img.id, "task_id": img.task_id, "template_id": img.template_id,
        "file_path": img.file_path, "original_name": img.original_name,
        "file_size": img.file_size, "display_order": img.display_order,
        "thumbnail_url": f"/api/task-images/file/{img.stored_path}" if img.stored_path else None,
    } for img in images]


@router.get("/file/{path:path}")
async def serve_task_image(path: str):
    """Serve an uploaded task image file."""
    full_path = os.path.join(UPLOAD_DIR, path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Image not found")
    return FileResponse(full_path, headers={"Cache-Control": "public, max-age=86400"})


@router.post("/copy-to-execution")
async def copy_to_execution(data: dict, db: AsyncSession = Depends(get_db)):
    """Copy task-template images to an execution record (for history)."""
    import shutil
    task_id = data["task_id"]
    template_id = data["template_id"]
    execution_id = data["execution_id"]

    result = await db.execute(
        select(TaskTemplateImage)
        .where(TaskTemplateImage.task_id == task_id, TaskTemplateImage.template_id == template_id)
        .order_by(TaskTemplateImage.display_order)
    )
    task_images = result.scalars().all()

    from app.models.image import ExecutionImage

    for i, timg in enumerate(task_images):
        # Copy the stored file to executions directory
        stored_url = None
        if timg.stored_path:
            src = os.path.join(UPLOAD_DIR, timg.stored_path)
            if os.path.isfile(src):
                exec_dir = os.path.join(UPLOAD_DIR, "executions", str(execution_id))
                os.makedirs(exec_dir, exist_ok=True)
                import uuid as _uuid
                ext = os.path.splitext(timg.original_name)[1] or ".png"
                new_name = f"{_uuid.uuid4().hex}{ext}"
                dst = os.path.join(exec_dir, new_name)
                shutil.copy2(src, dst)
                stored_url = f"executions/{execution_id}/{new_name}"

        eimg = ExecutionImage(
            execution_id=execution_id,
            image_type="uploaded" if stored_url else "file_path",
            file_path=timg.file_path,  # User's LOCAL path (for display)
            original_name=stored_url or timg.original_name,  # Server path (for URL) or just name
            file_size=timg.file_size,
            mime_type=timg.mime_type,
            display_order=i,
        )
        db.add(eimg)

    await db.commit()
    return {"copied": len(task_images)}


@router.delete("/{image_id}", status_code=204)
async def delete_task_image(image_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a task-template image."""
    img = await db.get(TaskTemplateImage, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    if img.stored_path:
        delete_single_image(img.stored_path)
    await db.delete(img)
    await db.commit()
