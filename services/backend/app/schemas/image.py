from datetime import datetime

from pydantic import BaseModel


class ImagePathCreate(BaseModel):
    execution_id: int
    file_path: str
    display_order: int = 0


class ImageResponse(BaseModel):
    id: int
    execution_id: int
    image_type: str
    file_path: str
    original_name: str
    file_size: int | None = None
    mime_type: str | None = None
    display_order: int
    url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
