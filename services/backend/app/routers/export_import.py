import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.group import PromptGroup
from app.models.variable import Variable
from app.models.template import PromptTemplate
from app.schemas.export_import import PromptFlowExport, ExportGroup, ExportVariable, ExportTemplate, NameCheckResponse
from app.schemas.group import GroupResponse

router = APIRouter()


def _suggest_name(base_name: str, existing_names: set[str]) -> str:
    """Generate a unique name by appending (2), (3), etc."""
    if base_name not in existing_names:
        return base_name
    for i in range(2, 100):
        candidate = f"{base_name} ({i})"
        if candidate not in existing_names:
            return candidate
    return f"{base_name} ({datetime.now().strftime('%H%M%S')})"


@router.get("/{group_id}/export")
async def export_group(group_id: int, template_ids: str | None = None, db: AsyncSession = Depends(get_db)):
    """Export a group with variables and templates as a .promptflow.json file."""
    group = await db.get(PromptGroup, group_id)
    if not group:
        raise HTTPException(404, "Group not found")

    # Load variables
    result = await db.execute(select(Variable).where(Variable.group_id == group_id).order_by(Variable.name))
    variables = result.scalars().all()

    # Load templates (all or selected)
    query = select(PromptTemplate).where(PromptTemplate.group_id == group_id)
    if template_ids:
        try:
            ids = [int(x.strip()) for x in template_ids.split(",")]
            query = query.where(PromptTemplate.id.in_(ids))
        except ValueError:
            raise HTTPException(400, "template_ids must be comma-separated integers")
    query = query.order_by(PromptTemplate.order, PromptTemplate.name)
    result = await db.execute(query)
    templates = result.scalars().all()

    # Determine which variables are actually used in the selected templates
    from app.services.renderer import extract_placeholders
    used_vars = set()
    for t in templates:
        used_vars.update(extract_placeholders(t.content))

    export_data = PromptFlowExport(
        format_version="1.0",
        exported_at=datetime.now(timezone.utc).isoformat(),
        group=ExportGroup(name=group.name, description=group.description),
        variables=[
            ExportVariable(name=v.name, description=v.description, var_type=v.var_type, default_value=v.default_value)
            for v in variables if v.name in used_vars
        ],
        templates=[
            ExportTemplate(name=t.name, content=t.content, order=t.order)
            for t in templates
        ],
    )

    # Sanitize filename
    safe_name = re.sub(r'[^\w\s-]', '', group.name).strip().replace(' ', '_')
    filename = f"{safe_name}.promptflow.json"

    return JSONResponse(
        content=export_data.model_dump(),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=GroupResponse, status_code=201)
async def import_group(data: PromptFlowExport, group_name: str | None = None, db: AsyncSession = Depends(get_db)):
    """Import a group from a PromptFlow export file."""
    # Validate format version
    if data.format_version:
        try:
            major = int(data.format_version.split(".")[0])
            if major > 1:
                raise HTTPException(422, "This file was created by a newer version of PromptFlow")
        except ValueError:
            raise HTTPException(422, "Invalid format_version")

    # Determine group name
    name = group_name or data.group.name
    if not name or not name.strip():
        raise HTTPException(422, "Group name is required")
    name = name.strip()

    # Check name uniqueness
    result = await db.execute(select(PromptGroup.name))
    existing_names = {row[0] for row in result.all()}
    if name in existing_names:
        suggested = _suggest_name(name, existing_names)
        raise HTTPException(409, detail=f"Group name '{name}' already exists. Suggested: '{suggested}'")

    # Create group
    group = PromptGroup(name=name, description=data.group.description)
    db.add(group)
    await db.flush()

    # Create variables
    seen_vars = set()
    for v in data.variables:
        if v.name in seen_vars:
            continue  # Skip duplicates silently
        seen_vars.add(v.name)
        db.add(Variable(
            group_id=group.id, name=v.name, description=v.description,
            var_type=v.var_type if v.var_type in ("text", "textarea", "number", "file") else "text",
            default_value=v.default_value,
        ))

    # Create templates
    for t in data.templates:
        db.add(PromptTemplate(
            group_id=group.id, name=t.name, content=t.content, order=t.order,
        ))

    await db.commit()
    await db.refresh(group)
    return group


@router.get("/check-name", response_model=NameCheckResponse)
async def check_group_name(name: str, db: AsyncSession = Depends(get_db)):
    """Check if a group name is available."""
    result = await db.execute(select(PromptGroup.name))
    existing_names = {row[0] for row in result.all()}
    if name.strip() not in existing_names:
        return NameCheckResponse(available=True)
    suggested = _suggest_name(name.strip(), existing_names)
    return NameCheckResponse(available=False, suggested_name=suggested)
