from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.group import PromptGroup
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse

router = APIRouter()


@router.get("", response_model=list[GroupResponse])
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptGroup).order_by(PromptGroup.name))
    return result.scalars().all()


@router.post("", response_model=GroupResponse, status_code=201)
async def create_group(data: GroupCreate, db: AsyncSession = Depends(get_db)):
    group = PromptGroup(name=data.name, description=data.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await db.get(PromptGroup, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    return group


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(group_id: int, data: GroupUpdate, db: AsyncSession = Depends(get_db)):
    group = await db.get(PromptGroup, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(group, key, val)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await db.get(PromptGroup, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    await db.delete(group)
    await db.commit()
