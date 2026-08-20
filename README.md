# Daily Task Tracker Backend

A simple FastAPI backend with SQLite database for tracking daily tasks.

## Setup Instructions

1. **Install Python** (if not already installed).
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the FastAPI server**:
   ```bash
   uvicorn main:app --reload
   ```

The server will start at `http://127.0.0.1:8000`. You can access the interactive API documentation at `http://127.0.0.1:8000/docs`.

## API Endpoints

- **POST `/tasks/`**: Create a new task (JSON body: `title`, `description`)
- **GET `/tasks/`**: Retrieve all tasks
- **PUT `/tasks/{task_id}`**: Update a task's completed status (JSON body: `completed` boolean)
- **DELETE `/tasks/{task_id}`**: Delete a task by ID

CORS is enabled for all origins so local frontends can easily connect to it.
