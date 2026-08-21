from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Medium"

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    completed: bool
    priority: Optional[str] = None

class Task(TaskBase):
    id: int
    completed: bool
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class HistoryEntry(BaseModel):
    id: int
    task_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    created_at: Optional[datetime] = None
    completed_at: datetime

    class Config:
        from_attributes = True

class HistoryTaskDetail(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    created_at: Optional[datetime] = None
    completed_at: datetime

class DailyCount(BaseModel):
    date: date
    count: int
    tasks: List[HistoryTaskDetail] = []
