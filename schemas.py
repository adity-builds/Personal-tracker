from datetime import date
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
    completed_at: Optional[date] = None

    class Config:
        from_attributes = True

class DailyCount(BaseModel):
    date: date
    count: int
    tasks: List[str] = []
