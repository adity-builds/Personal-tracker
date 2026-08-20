from sqlalchemy import Boolean, Column, Date, Integer, String
from database import Base

class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    completed_at = Column(Date, nullable=True)
