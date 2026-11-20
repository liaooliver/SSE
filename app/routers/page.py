"""Frontend page (R26, R27)."""

import asyncio
from pathlib import Path
from typing import Final

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

_PAGE_PATH: Final = Path(__file__).resolve().parent.parent / "static" / "index.html"


@router.get("/", response_class=HTMLResponse)
async def index_page() -> HTMLResponse:
    """R26: serve the single self-contained HTML page whose script implements R27."""
    html = await asyncio.to_thread(_PAGE_PATH.read_text, encoding="utf-8")
    return HTMLResponse(html)
