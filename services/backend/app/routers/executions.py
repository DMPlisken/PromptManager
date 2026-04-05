from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.execution import TaskExecution
from app.models.group import PromptGroup
from app.models.template import PromptTemplate
from app.schemas.execution import ExecutionCreate, ExecutionResponse

router = APIRouter()


@router.get("", response_model=list[ExecutionResponse])
async def list_executions(
    group_id: int | None = None,
    template_id: int | None = None,
    task_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(TaskExecution).options(
        selectinload(TaskExecution.group),
        selectinload(TaskExecution.template),
        selectinload(TaskExecution.task),
    )
    if group_id is not None:
        query = query.where(TaskExecution.group_id == group_id)
    if template_id is not None:
        query = query.where(TaskExecution.template_id == template_id)
    if task_id is not None:
        query = query.where(TaskExecution.task_id == task_id)
    query = query.order_by(TaskExecution.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    executions = result.scalars().all()
    return [
        ExecutionResponse(
            id=e.id,
            group_id=e.group_id,
            template_id=e.template_id,
            task_id=e.task_id,
            filled_prompt=e.filled_prompt,
            variable_values=e.variable_values,
            notes=e.notes,
            created_at=e.created_at,
            group_name=e.group.name if e.group else None,
            template_name=e.template.name if e.template else None,
            task_name=e.task.name if e.task else None,
        )
        for e in executions
    ]


@router.post("", response_model=ExecutionResponse, status_code=201)
async def create_execution(data: ExecutionCreate, db: AsyncSession = Depends(get_db)):
    execution = TaskExecution(**data.model_dump())
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    # Load relationships for response
    group = await db.get(PromptGroup, execution.group_id)
    template = await db.get(PromptTemplate, execution.template_id)
    return ExecutionResponse(
        id=execution.id,
        group_id=execution.group_id,
        template_id=execution.template_id,
        filled_prompt=execution.filled_prompt,
        variable_values=execution.variable_values,
        notes=execution.notes,
        created_at=execution.created_at,
        group_name=group.name if group else None,
        template_name=template.name if template else None,
    )


@router.delete("/{execution_id}", status_code=204)
async def delete_execution(execution_id: int, db: AsyncSession = Depends(get_db)):
    execution = await db.get(TaskExecution, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    await db.delete(execution)
    await db.commit()
