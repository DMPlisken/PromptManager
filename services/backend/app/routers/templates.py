from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.template import PromptTemplate
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse, RenderRequest, RenderResponse
from app.services.renderer import render_template, extract_placeholders

router = APIRouter()


@router.get("", response_model=list[TemplateResponse])
async def list_templates(group_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(PromptTemplate)
    if group_id is not None:
        query = query.where(PromptTemplate.group_id == group_id)
    result = await db.execute(query.order_by(PromptTemplate.order, PromptTemplate.name))
    return result.scalars().all()


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(data: TemplateCreate, db: AsyncSession = Depends(get_db)):
    tmpl = PromptTemplate(**data.model_dump())
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    return tmpl


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, data: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(tmpl, key, val)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    await db.delete(tmpl)
    await db.commit()


@router.post("/{template_id}/render", response_model=RenderResponse)
async def render(template_id: int, data: RenderRequest, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    rendered = render_template(tmpl.content, data.variables)
    return RenderResponse(rendered=rendered, template_id=tmpl.id, template_name=tmpl.name)


@router.get("/{template_id}/placeholders", response_model=list[str])
async def get_placeholders(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    return extract_placeholders(tmpl.content)
