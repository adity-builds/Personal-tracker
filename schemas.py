from datetime import date, datetime
from typing import Dict, List, Optional
from pydantic import BaseModel

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "Medium"

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    completed: bool
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None

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

class DayCount(BaseModel):
    date: date
    count: int

class StatsSummary(BaseModel):
    total_completions: int = 0
    current_streak: int = 0
    best_day: Optional[date] = None
    best_day_count: int = 0
    last_7_days: List[DayCount] = []
    by_priority: Dict[str, int] = {}
