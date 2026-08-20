from datetime import date
import os
import sys

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from flaskwebgui import FlaskUI
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

def resource_path(relative_path: str) -> str:
    base_path = getattr(sys, "_MEIPASS", os.path.abspath("."))
    return os.path.join(base_path, relative_path)

models.Base.metadata.create_all(bind=database.engine)
database.migrate()

app = FastAPI(title="Daily Task Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=resource_path("static")), name="static")

@app.get("/")
def read_index():
    return FileResponse(resource_path("static/index.html"))

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/tasks/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.TaskModel(
        title=task.title,
        description=task.description,
        completed=False,
        priority=task.priority,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(models.TaskModel).offset(skip).limit(limit).all()
    return tasks

@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task_status(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    was_completed = db_task.completed

    db_task.completed = task_update.completed
    db_task.completed_at = date.today() if task_update.completed else None
    if task_update.priority is not None:
        db_task.priority = task_update.priority

    history_entry = (
        db.query(models.HistoryModel)
        .filter(models.HistoryModel.task_id == task_id)
        .first()
    )
    if task_update.completed and not was_completed:
        if history_entry is None:
            history_entry = models.HistoryModel(
                task_id=task_id,
                title=db_task.title,
                completed_at=date.today(),
            )
            db.add(history_entry)
        else:
            history_entry.title = db_task.title
            history_entry.completed_at = date.today()
    elif not task_update.completed and was_completed:
        if history_entry is not None:
            db.delete(history_entry)

    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/history/", response_model=List[schemas.DailyCount])
def read_history(db: Session = Depends(get_db)):
    rows = (
        db.query(models.HistoryModel)
        .order_by(
            models.HistoryModel.completed_at.desc(),
            models.HistoryModel.id.desc(),
        )
        .all()
    )
    grouped = {}
    for row in rows:
        grouped.setdefault(row.completed_at, []).append(row.title)
    return [
        {"date": day, "count": len(titles), "tasks": titles}
        for day, titles in grouped.items()
    ]

@app.delete("/tasks/{task_id}", response_model=dict)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"ok": True}


if __name__ == "__main__":
    FlaskUI(
        app=app,
        server="fastapi",
        port=8000,
        width=1000,
        height=720,
        fullscreen=False,
    ).run()
