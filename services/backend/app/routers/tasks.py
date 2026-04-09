from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.task import Task, TaskTemplate
from app.models.tag import Tag, TaskTag
from app.models.template import PromptTemplate
from app.models.group import PromptGroup
from app.models.execution import TaskExecution
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse,
    TaskTemplateAdd, TaskTemplateInfo, TaskRenderResponse,
)
from app.services.renderer import render_template, extract_placeholders

router = APIRouter()


async def _build_task_response(task: Task, db: AsyncSession) -> TaskResponse:
    """Build a full TaskResponse with template info and placeholders."""
    templates_info = []
    for tt in task.task_templates:
        tmpl = await db.get(PromptTemplate, tt.template_id)
        group = await db.get(PromptGroup, tmpl.group_id) if tmpl else None
        placeholders = extract_placeholders(tmpl.content) if tmpl else []
        templates_info.append(TaskTemplateInfo(
            id=tt.id,
            template_id=tt.template_id,
            template_name=tmpl.name if tmpl else "Unknown",
            group_name=group.name if group else "Unknown",
            order=tt.order,
            use_count=tt.use_count,
            placeholders=placeholders,
        ))
    return TaskResponse(
        id=task.id, name=task.name, description=task.description,
        status=task.status, variable_values=task.variable_values,
        created_at=task.created_at, updated_at=task.updated_at,
        templates=templates_info,
    )


@router.get("", response_model=list[TaskListResponse])
async def list_tasks(status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Task).options(selectinload(Task.task_templates), selectinload(Task.task_tags))
    if status:
        query = query.where(Task.status == status)
    query = query.order_by(Task.updated_at.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()
    return [
        TaskListResponse(
            id=t.id, name=t.name, description=t.description, status=t.status,
            template_count=len(t.task_templates),
            tag_ids=[tt.tag_id for tt in t.task_tags],
            created_at=t.created_at, updated_at=t.updated_at,
        )
        for t in tasks
    ]


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(name=data.name, description=data.description)
    db.add(task)
    await db.flush()
    for i, tid in enumerate(data.template_ids):
        tmpl = await db.get(PromptTemplate, tid)
        if not tmpl:
            raise HTTPException(400, f"Template {tid} not found")
        db.add(TaskTemplate(task_id=task.id, template_id=tid, order=i))
    await db.commit()
    await db.refresh(task)
    # Reload with relationships
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task.id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    return await _build_task_response(task, db)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(task, key, val)
    await db.commit()
    await db.refresh(task)
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()


@router.post("/{task_id}/templates", response_model=TaskResponse)
async def add_template_to_task(task_id: int, data: TaskTemplateAdd, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    tmpl = await db.get(PromptTemplate, data.template_id)
    if not tmpl:
        raise HTTPException(400, "Template not found")
    # Check if already added
    for tt in task.task_templates:
        if tt.template_id == data.template_id:
            raise HTTPException(400, "Template already in task")
    db.add(TaskTemplate(task_id=task_id, template_id=data.template_id, order=data.order))
    await db.commit()
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.delete("/{task_id}/templates/{template_id}", response_model=TaskResponse)
async def remove_template_from_task(task_id: int, template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskTemplate).where(TaskTemplate.task_id == task_id, TaskTemplate.template_id == template_id)
    )
    tt = result.scalar_one_or_none()
    if not tt:
        raise HTTPException(404, "Template not in task")
    await db.delete(tt)
    await db.commit()
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.put("/{task_id}/templates/{template_id}/count", response_model=TaskResponse)
async def update_template_use_count(task_id: int, template_id: int, count: int, db: AsyncSession = Depends(get_db)):
    """Update the use_count for a template in a task."""
    result = await db.execute(
        select(TaskTemplate).where(TaskTemplate.task_id == task_id, TaskTemplate.template_id == template_id)
    )
    tt = result.scalar_one_or_none()
    if not tt:
        raise HTTPException(404, "Template not in task")
    tt.use_count = max(0, count)
    await db.commit()
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.put("/{task_id}/templates/reorder", response_model=TaskResponse)
async def reorder_task_templates(task_id: int, template_ids: list[int], db: AsyncSession = Depends(get_db)):
    """Reorder templates in a task. Expects ordered list of template_ids."""
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    for tt in task.task_templates:
        if tt.template_id in template_ids:
            tt.order = template_ids.index(tt.template_id)
    await db.commit()
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.get("/{task_id}/variables", response_model=list[str])
async def get_task_variables(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get merged unique placeholders from all templates in the task."""
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    all_vars: list[str] = []
    seen = set()
    for tt in task.task_templates:
        tmpl = await db.get(PromptTemplate, tt.template_id)
        if tmpl:
            for v in extract_placeholders(tmpl.content):
                if v not in seen:
                    seen.add(v)
                    all_vars.append(v)
    return all_vars


@router.put("/{task_id}/tags")
async def set_task_tags(task_id: int, tag_ids: list[int], db: AsyncSession = Depends(get_db)):
    """Replace all tags on a task."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    # Delete existing
    result = await db.execute(select(TaskTag).where(TaskTag.task_id == task_id))
    for tt in result.scalars().all():
        await db.delete(tt)
    # Add new
    for tid in tag_ids:
        tag = await db.get(Tag, tid)
        if tag:
            db.add(TaskTag(task_id=task_id, tag_id=tid))
    await db.commit()


@router.post("/{task_id}/duplicate", response_model=TaskResponse, status_code=201)
async def duplicate_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Duplicate a task with all its templates, tags, images, and variable values."""
    result = await db.execute(
        select(Task).options(
            selectinload(Task.task_templates),
            selectinload(Task.task_tags),
        ).where(Task.id == task_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Task not found")

    # Create new task
    new_task = Task(
        name=f"{source.name} (copy)",
        description=source.description,
        variable_values=dict(source.variable_values) if source.variable_values else {},
    )
    db.add(new_task)
    await db.flush()

    # Copy templates (reset use_count)
    for tt in source.task_templates:
        db.add(TaskTemplate(
            task_id=new_task.id, template_id=tt.template_id,
            order=tt.order, use_count=0,
        ))

    # Copy tags
    for tt in source.task_tags:
        db.add(TaskTag(task_id=new_task.id, tag_id=tt.tag_id))

    # Copy task-template images
    from app.models.task_template_image import TaskTemplateImage
    img_result = await db.execute(
        select(TaskTemplateImage).where(TaskTemplateImage.task_id == task_id)
    )
    for img in img_result.scalars().all():
        db.add(TaskTemplateImage(
            task_id=new_task.id, template_id=img.template_id,
            file_path=img.file_path, stored_path=img.stored_path,
            original_name=img.original_name, file_size=img.file_size,
            mime_type=img.mime_type, display_order=img.display_order,
        ))

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == new_task.id)
    )
    task = result.scalar_one()
    return await _build_task_response(task, db)


@router.post("/{task_id}/render/{template_id}", response_model=TaskRenderResponse)
async def render_task_template(task_id: int, template_id: int, db: AsyncSession = Depends(get_db)):
    """Render a template using the task's variable values and save as execution."""
    result = await db.execute(
        select(Task).options(selectinload(Task.task_templates)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    tmpl = await db.get(PromptTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    rendered = render_template(tmpl.content, task.variable_values)
    execution = TaskExecution(
        group_id=tmpl.group_id, template_id=template_id, task_id=task_id,
        filled_prompt=rendered, variable_values=task.variable_values,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return TaskRenderResponse(
        rendered=rendered, template_id=template_id,
        template_name=tmpl.name, execution_id=execution.id,
    )
