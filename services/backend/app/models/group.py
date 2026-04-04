from datetime import datetime

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PromptGroup(Base):
    __tablename__ = "prompt_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variables = relationship("Variable", back_populates="group", cascade="all, delete-orphan")
    templates = relationship("PromptTemplate", back_populates="group", cascade="all, delete-orphan")
    executions = relationship("TaskExecution", back_populates="group", cascade="all, delete-orphan")
