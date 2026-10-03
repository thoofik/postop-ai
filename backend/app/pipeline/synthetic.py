"""Synthetic wound photographs so the timeline, chart, and report can be demoed."""

from datetime import datetime, timedelta, timezone

import numpy as np
from PIL import Image, ImageDraw


def _skin(rng: np.random.Generator, height: int, width: int) -> np.ndarray:
    base = np.zeros((height, width, 3), dtype=np.float32)
    base[:, :, 0] = 226
    base[:, :, 1] = 186
    base[:, :, 2] = 162
    y = np.linspace(-1, 1, height, dtype=np.float32)[:, None]
    x = np.linspace(-1, 1, width, dtype=np.float32)[None, :]
    shade = 10 * (0.35 * x + 0.2 * y)
    base += shade[:, :, None]
    base += rng.normal(0, 11, size=base.shape)
    return np.clip(base, 0, 255)


def _paint_ellipse(
    array: np.ndarray,
    center: tuple[int, int],
    radii: tuple[int, int],
    color: tuple[int, int, int],
) -> None:
    height, width = array.shape[:2]
    cy, cx = center
    ry, rx = radii
    yy, xx = np.ogrid[:height, :width]
    mask = ((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2 <= 1
    array[mask] = color


def synthetic_wound(kind: str, seed: int = 0) -> Image.Image:
    height, width = 1200, 900
    rng = np.random.default_rng(seed)
    array = _skin(rng, height, width)
    cy, cx = 640, 450

    if kind == "high":
        _paint_ellipse(array, (cy, cx), (250, 150), (168, 42, 38))
        _paint_ellipse(array, (cy + 10, cx), (120, 78), (206, 176, 64))
        _paint_ellipse(array, (cy + 8, cx), (46, 30), (150, 36, 32))
    elif kind == "moderate":
        _paint_ellipse(array, (cy, cx), (230, 110), (214, 138, 124))
    else:
        array[cy - 180 : cy + 180, cx - 2 : cx + 3] = (196, 142, 136)

    image = Image.fromarray(array.astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(image)
    for index in range(-4, 5):
        y = cy + index * 38
        draw.line((cx - 16, y, cx + 16, y), fill=(48, 52, 58), width=3)
    return image


def demo_series(now: datetime | None = None) -> list[dict]:
    moment = now or datetime.now(timezone.utc)
    return [
        {
            "kind": "high",
            "seed": 11,
            "days_post_op": 2,
            "created_at": (moment - timedelta(days=9)).isoformat(),
        },
        {
            "kind": "moderate",
            "seed": 12,
            "days_post_op": 6,
            "created_at": (moment - timedelta(days=5)).isoformat(),
        },
        {
            "kind": "low",
            "seed": 13,
            "days_post_op": 11,
            "created_at": (moment - timedelta(days=1)).isoformat(),
        },
    ]
