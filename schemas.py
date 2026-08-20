from datetime import date
from typing import Optional
from pydantic import BaseModel

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    completed: bool

class Task(TaskBase):
    id: int
    completed: bool
    completed_at: Optional[date] = None

    class Config:
        from_attributes = True

class DailyCount(BaseModel):
    date: date
    count: int
