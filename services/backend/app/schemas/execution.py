from datetime import datetime

from pydantic import BaseModel


class ExecutionCreate(BaseModel):
    group_id: int
    template_id: int
    filled_prompt: str
    variable_values: dict[str, str]
    notes: str | None = None


class ExecutionResponse(BaseModel):
    id: int
    group_id: int
    template_id: int
    filled_prompt: str
    variable_values: dict
    notes: str | None
    created_at: datetime
    group_name: str | None = None
    template_name: str | None = None

    model_config = {"from_attributes": True}
