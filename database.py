from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./tasks.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def migrate():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "tasks" in tables:
        columns = {col["name"] for col in inspector.get_columns("tasks")}
        if "priority" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN priority VARCHAR DEFAULT 'Medium'"))

    if "history" in tables:
        with engine.begin() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM history")).scalar()
        if count == 0:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO history (task_id, title, completed_at) "
                        "SELECT id, title, completed_at FROM tasks WHERE completed_at IS NOT NULL"
                    )
                )
    else:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE history (id INTEGER NOT NULL PRIMARY KEY, "
                    "task_id INTEGER, title VARCHAR, completed_at DATE)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO history (task_id, title, completed_at) "
                    "SELECT id, title, completed_at FROM tasks WHERE completed_at IS NOT NULL"
                )
            )
