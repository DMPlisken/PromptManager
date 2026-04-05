from datetime import datetime

from pydantic import BaseModel


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    template_ids: list[int] = []


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    variable_values: dict[str, str] | None = None


class TaskTemplateAdd(BaseModel):
    template_id: int
    order: int = 0


class TaskTemplateInfo(BaseModel):
    id: int
    template_id: int
    template_name: str
    group_name: str
    order: int
    use_count: int = 0
    placeholders: list[str]

    model_config = {"from_attributes": True}


class TaskResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    variable_values: dict
    created_at: datetime
    updated_at: datetime
    templates: list[TaskTemplateInfo] = []

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    template_count: int
    tag_ids: list[int] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskRenderResponse(BaseModel):
    rendered: str
    template_id: int
    template_name: str
    execution_id: int
