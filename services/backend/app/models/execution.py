from datetime import datetime

from sqlalchemy import Text, Integer, ForeignKey, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskExecution(Base):
    __tablename__ = "task_executions"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("prompt_groups.id", ondelete="CASCADE"), nullable=False)
    template_id: Mapped[int] = mapped_column(Integer, ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False)
    task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    filled_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    variable_values: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group = relationship("PromptGroup", back_populates="executions")
    template = relationship("PromptTemplate", back_populates="executions")
    task = relationship("Task", back_populates="executions", foreign_keys=[task_id])
    images = relationship("ExecutionImage", back_populates="execution", cascade="all, delete-orphan", order_by="ExecutionImage.display_order")
