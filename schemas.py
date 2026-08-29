from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict

class TaskBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "Medium"

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

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

class HistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    created_at: Optional[datetime] = None
    completed_at: datetime

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
