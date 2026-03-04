from pydantic import BaseModel

class ProjectScore(BaseModel):
    project_id: int
    score: float
