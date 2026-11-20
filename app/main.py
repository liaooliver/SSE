"""App factory and lifespan (R1-R3, R25)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import install, page, system
from app.runtime import Runtime, resolve_settings


def create_app(
    db_path: str | None = None,
    log_interval: float | None = None,
    heartbeat_interval: float | None = None,
    subscriber_queue_size: int | None = None,
) -> FastAPI:
    """R2/R3: build a new, independent app; no I/O happens until lifespan startup."""
    settings = resolve_settings(db_path, log_interval, heartbeat_interval, subscriber_queue_size)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        runtime = Runtime(settings)
        await runtime.start()
        app.state.runtime = runtime
        try:
            yield
        finally:
            await runtime.stop()

    app = FastAPI(title="Install progress streaming", version="1.0.0", lifespan=lifespan)
    app.include_router(install.router)
    app.include_router(system.router)
    app.include_router(page.router)
    return app


app = create_app()
