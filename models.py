from sqlalchemy import Boolean, Column, DateTime, Integer, String
from datetime import datetime
from database import Base

class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    priority = Column(String, default="Medium")

class HistoryModel(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, nullable=True, index=True)
    title = Column(String)
    description = Column(String, nullable=True)
    priority = Column(String, default="Medium")
    created_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, index=True)
