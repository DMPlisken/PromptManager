import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.image import ExecutionImage
from app.models.execution import TaskExecution
from app.schemas.image import ImagePathCreate, ImageResponse
from app.services.image_storage import (
    save_upload, delete_single_image, UPLOAD_DIR, MAX_SIZE, ALLOWED_TYPES,
)

router = APIRouter()


def _to_response(img: ExecutionImage) -> ImageResponse:
    url = None
    # Generate URL: original_name may contain server path like "executions/10/abc.png"
    if img.image_type == "uploaded":
        server_path = img.original_name if img.original_name.startswith("executions/") else img.file_path
        parts = server_path.split("/")
        if len(parts) >= 3:
            url = f"/api/images/{parts[1]}/{parts[2]}"
    # Display name = just the filename, never a full path
    display_name = os.path.basename(img.file_path) if img.file_path else img.original_name
    if display_name.startswith("executions/") or "/" in display_name:
        display_name = os.path.basename(display_name)
    return ImageResponse(
        id=img.id, execution_id=img.execution_id, image_type=img.image_type,
        file_path=img.file_path, original_name=display_name,
        file_size=img.file_size, mime_type=img.mime_type,
        display_order=img.display_order, url=url, created_at=img.created_at,
    )


@router.post("/upload", response_model=ImageResponse, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    execution_id: int = Form(...),
    display_order: int = Form(0),
    db: AsyncSession = Depends(get_db),
):
    # Validate execution exists
    execution = await db.get(TaskExecution, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    # Read and validate size
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, f"File too large (max {MAX_SIZE // 1024 // 1024}MB)")

    relative_path, filename = await save_upload(
        execution_id, content, file.filename or "image.png", file.content_type or "image/png"
    )

    img = ExecutionImage(
        execution_id=execution_id, image_type="uploaded",
        file_path=relative_path, original_name=file.filename or "image.png",
        file_size=len(content), mime_type=file.content_type,
        display_order=display_order,
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return _to_response(img)


@router.post("/path", response_model=ImageResponse, status_code=201)
async def add_image_path(data: ImagePathCreate, db: AsyncSession = Depends(get_db)):
    execution = await db.get(TaskExecution, data.execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    original_name = os.path.basename(data.file_path) or "unknown"
    img = ExecutionImage(
        execution_id=data.execution_id, image_type="file_path",
        file_path=data.file_path, original_name=original_name,
        display_order=data.display_order,
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return _to_response(img)


@router.get("/execution/{execution_id}", response_model=list[ImageResponse])
async def list_execution_images(execution_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExecutionImage)
        .where(ExecutionImage.execution_id == execution_id)
        .order_by(ExecutionImage.display_order)
    )
    return [_to_response(img) for img in result.scalars().all()]


@router.get("/{execution_id}/{filename}")
async def serve_image(execution_id: int, filename: str):
    file_path = os.path.join(UPLOAD_DIR, "executions", str(execution_id), filename)
    if not os.path.isfile(file_path):
        raise HTTPException(404, "Image not found")
    return FileResponse(file_path, headers={"Cache-Control": "public, max-age=86400"})


@router.delete("/{image_id}", status_code=204)
async def delete_image(image_id: int, db: AsyncSession = Depends(get_db)):
    img = await db.get(ExecutionImage, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    if img.image_type == "uploaded":
        delete_single_image(img.file_path)
    await db.delete(img)
    await db.commit()
