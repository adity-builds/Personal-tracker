from sqlalchemy import Boolean, Column, Date, Integer, String
from database import Base

class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    completed_at = Column(Date, nullable=True)
    priority = Column(String, default="Medium")

class HistoryModel(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, nullable=True, index=True)
    title = Column(String)
    completed_at = Column(Date, index=True)
