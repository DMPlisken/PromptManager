from pydantic import BaseModel


class ExportVariable(BaseModel):
    name: str
    description: str | None = None
    var_type: str = "text"
    default_value: str | None = None


class ExportTemplate(BaseModel):
    name: str
    content: str
    order: int = 0


class ExportGroup(BaseModel):
    name: str
    description: str | None = None


class PromptFlowExport(BaseModel):
    format_version: str = "1.0"
    exported_at: str | None = None
    group: ExportGroup
    variables: list[ExportVariable] = []
    templates: list[ExportTemplate] = []


class NameCheckResponse(BaseModel):
    available: bool
    suggested_name: str | None = None
