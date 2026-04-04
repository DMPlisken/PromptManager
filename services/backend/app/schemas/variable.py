from datetime import datetime

from pydantic import BaseModel


class VariableCreate(BaseModel):
    group_id: int
    name: str
    description: str | None = None
    default_value: str | None = None
    var_type: str = "text"


class VariableUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_value: str | None = None
    var_type: str | None = None


class VariableResponse(BaseModel):
    id: int
    group_id: int
    name: str
    description: str | None
    default_value: str | None
    var_type: str
    created_at: datetime

    model_config = {"from_attributes": True}
