from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.variable import Variable
from app.schemas.variable import VariableCreate, VariableUpdate, VariableResponse

router = APIRouter()


@router.get("", response_model=list[VariableResponse])
async def list_variables(group_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Variable)
    if group_id is not None:
        query = query.where(Variable.group_id == group_id)
    result = await db.execute(query.order_by(Variable.name))
    return result.scalars().all()


@router.post("", response_model=VariableResponse, status_code=201)
async def create_variable(data: VariableCreate, db: AsyncSession = Depends(get_db)):
    var = Variable(**data.model_dump())
    db.add(var)
    await db.commit()
    await db.refresh(var)
    return var


@router.put("/{variable_id}", response_model=VariableResponse)
async def update_variable(variable_id: int, data: VariableUpdate, db: AsyncSession = Depends(get_db)):
    var = await db.get(Variable, variable_id)
    if not var:
        raise HTTPException(404, "Variable not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(var, key, val)
    await db.commit()
    await db.refresh(var)
    return var


@router.delete("/{variable_id}", status_code=204)
async def delete_variable(variable_id: int, db: AsyncSession = Depends(get_db)):
    var = await db.get(Variable, variable_id)
    if not var:
        raise HTTPException(404, "Variable not found")
    await db.delete(var)
    await db.commit()
