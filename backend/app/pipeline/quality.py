"""Step 4 — reject photographs that are too small, soft, dark, or blank."""

from dataclasses import asdict, dataclass

import numpy as np
from PIL import Image

# A farther photo is still a full camera frame. Only reject files that are
# actually too small to contain a wound, not ones where the wound is small in the picture.
MIN_SIDE = 96
MIN_BLUR = 8.0
MIN_BRIGHTNESS = 42.0
MAX_BRIGHTNESS = 220.0
MIN_DETAIL = 4.0


@dataclass
class Check:
    id: str
    label: str
    passed: bool
    detail: str
    advice: str


@dataclass
class QualityReport:
    passed: bool
    width: int
    height: int
    blur_score: float
    brightness: float
    checks: list[Check]

    def to_dict(self) -> dict:
        return asdict(self)


def check_quality(image: Image.Image) -> QualityReport:
    rgb = image.convert("RGB")
    width, height = rgb.size
    array = np.asarray(rgb)
    gray = array.mean(axis=2)

    if gray.shape[0] < 3 or gray.shape[1] < 3:
        blur_score = 0.0
    else:
        center = gray[1:-1, 1:-1]
        lap = (
            gray[:-2, 1:-1]
            + gray[2:, 1:-1]
            + gray[1:-1, :-2]
            + gray[1:-1, 2:]
            - 4.0 * center
        )
        blur_score = float(lap.var())

    brightness = float(gray.mean()) if gray.size else 0.0
    detail = float(gray.std()) if gray.size else 0.0

    checks = [
        Check(
            id="resolution",
            label="Frame size",
            passed=min(width, height) >= MIN_SIDE,
            detail=f"{width} × {height}",
            advice="This file is too small to score. Use a photograph rather than a tiny thumbnail.",
        ),
        Check(
            id="blur",
            label="Focus",
            passed=blur_score >= MIN_BLUR,
            detail=f"Focus score {blur_score:.0f}",
            advice="Hold the phone steady until the skin edges look crisp.",
        ),
        Check(
            id="brightness",
            label="Lighting",
            passed=MIN_BRIGHTNESS <= brightness <= MAX_BRIGHTNESS,
            detail=f"Brightness {brightness:.0f}",
            advice="Use soft daylight or a lamp. Avoid a dark room and flash glare.",
        ),
        Check(
            id="detail",
            label="Surface detail",
            passed=detail >= MIN_DETAIL,
            detail=f"Texture {detail:.0f}",
            advice="The photograph looks blank. Retake it so the wound and nearby skin are visible.",
        ),
    ]
    return QualityReport(
        passed=all(check.passed for check in checks),
        width=width,
        height=height,
        blur_score=round(blur_score, 2),
        brightness=round(brightness, 2),
        checks=checks,
    )
