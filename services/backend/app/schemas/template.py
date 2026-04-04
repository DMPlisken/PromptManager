from datetime import datetime

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    group_id: int
    name: str
    content: str
    order: int = 0


class TemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    order: int | None = None


class TemplateResponse(BaseModel):
    id: int
    group_id: int
    name: str
    content: str
    order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RenderRequest(BaseModel):
    variables: dict[str, str]


class RenderResponse(BaseModel):
    rendered: str
    template_id: int
    template_name: str
