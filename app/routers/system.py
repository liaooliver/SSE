"""Operational endpoints (R16, R17)."""

from fastapi import APIRouter

from app.routers.install import RuntimeDep
from app.schemas import Health, Stats

router = APIRouter()


@router.get("/stats")
async def get_stats(runtime: RuntimeDep) -> Stats:
    """R16: number of open ``/install/events`` connections."""
    return Stats(subscribers=runtime.broker.count)


@router.get("/health")
async def health() -> Health:
    """R17: liveness; body is ``{"status": "ok"}``."""
    return Health(status="ok")
