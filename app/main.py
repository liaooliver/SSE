from fastapi import FastAPI


def create_app(
    heartbeat_interval: float | None = None,
    history_size: int | None = None,
    subscriber_queue_size: int | None = None,
) -> FastAPI:
    # TODO(T2.1): wire heartbeat_interval, history_size, subscriber_queue_size
    app = FastAPI(title="FastAPI Server-Sent Events demo")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
