from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import psycopg2.pool
from config import Config
import logging

app = FastAPI(title="CollabGrow Recommendations API", version="1.0.0")
logger = logging.getLogger(__name__)

# Initialize connection pool
db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    try:
        db_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,
            dsn=Config.get_db_uri()
        )
        logger.info("Database pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize pool: {e}")
        raise

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        db_pool.closeall()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "recommendations"}

@app.get("/recommend/projects/{user_id}")
async def recommend_projects(user_id: str):
    try:
        from services.recommendation import get_project_recommendations
        recommendations = get_project_recommendations(db_pool, user_id)
        return {"projects": recommendations}
    except Exception as e:
        logger.error(f"Error in recommend_projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommend/collaborators/{project_id}")
async def recommend_collaborators(project_id: str):
    try:
        from services.recommendation import get_collaborator_recommendations
        recommendations = get_collaborator_recommendations(db_pool, project_id)
        return {"collaborators": recommendations}
    except Exception as e:
        logger.error(f"Error in recommend_collaborators: {e}")
        raise HTTPException(status_code=500, detail=str(e))
