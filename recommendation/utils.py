from fastapi.responses import JSONResponse
from fastapi import Request

async def exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )
