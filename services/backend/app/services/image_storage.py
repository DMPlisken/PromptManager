import os
import shutil
import uuid

import aiofiles

from app.config import settings

UPLOAD_DIR = settings.upload_dir if hasattr(settings, "upload_dir") else "/app/uploads"
MAX_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"}


def get_execution_dir(execution_id: int) -> str:
    return os.path.join(UPLOAD_DIR, "executions", str(execution_id))


async def save_upload(execution_id: int, file_content: bytes, original_name: str, content_type: str) -> tuple[str, str]:
    """Save uploaded file, returns (relative_path, full_path)."""
    ext = os.path.splitext(original_name)[1].lower() or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    exec_dir = get_execution_dir(execution_id)
    os.makedirs(exec_dir, exist_ok=True)
    full_path = os.path.join(exec_dir, filename)
    async with aiofiles.open(full_path, "wb") as f:
        await f.write(file_content)
    relative_path = f"executions/{execution_id}/{filename}"
    return relative_path, filename


def delete_execution_images(execution_id: int) -> None:
    """Remove the entire executions/{id}/ directory."""
    dir_path = get_execution_dir(execution_id)
    if os.path.isdir(dir_path):
        shutil.rmtree(dir_path)


def delete_single_image(relative_path: str) -> None:
    """Delete a single image file."""
    full_path = os.path.join(UPLOAD_DIR, relative_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
