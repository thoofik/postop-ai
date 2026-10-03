"""Steps 5–7 — visual concern score.

This is a transparent prototype, not a trained diagnostic model.
It scores redness against surrounding skin and a yellow drainage signal,
then maps that score to a probability, a confidence, and a risk band.

Replace `infer` with a checkpoint later. Keep the same result shape,
including a full-image attention map so the Grad-CAM screen still works.
"""

from dataclasses import dataclass

import numpy as np
from PIL import Image

HIGH_AT = 0.70
MODERATE_AT = 0.42

SUMMARIES = {
    "LOW": "Lower visual concern. The wound colors in this photo sit in the low band.",
    "MODERATE": "Moderate visual concern. The wound colors are more intense than a calm incision.",
    "HIGH": "Higher visual concern. Redness or yellow signal is strong in this photo.",
}


@dataclass
class InferenceResult:
    risk_level: str
    probability: float
    confidence: float
    drivers: list[dict]
    summary: str
    method: str
    attention: np.ndarray


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def visual_signals(array: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    red = array[:, :, 0].astype(np.float32)
    green = array[:, :, 1].astype(np.float32)
    blue = array[:, :, 2].astype(np.float32)
    # Skin is red too. Saturated wound red pulls away from green and blue.
    redness = np.clip((red - green) / 85.0, 0, 1) * np.clip((red - blue) / 85.0, 0, 1)
    yellow_strength = np.clip(((red + green) * 0.5 - blue) / 80.0, 0, 1)
    # Skin is slightly warm. Yellow drainage is bright and much lower in blue.
    yellow_gate = (
        (np.abs(red - green) < 40) & (red > 150) & (green > 140) & (blue < 110)
    ).astype(np.float32)
    return redness, yellow_strength * yellow_gate


def _top_mean(values: np.ndarray, fraction: float) -> float:
    flat = values.reshape(-1)
    count = max(int(flat.size * fraction), 1)
    if count >= flat.size:
        return float(flat.mean())
    return float(np.partition(flat, -count)[-count:].mean())


def infer_visual(image: Image.Image) -> InferenceResult:
    redness, yellow = visual_signals(np.asarray(image.convert("RGB")))
    redness_score = _top_mean(redness, 0.04)
    exudate_score = _top_mean(yellow, 0.02)
    hot_fraction = float((redness > 0.45).mean())

    probability = _clip(
        0.08 + 0.57 * redness_score + 0.32 * exudate_score,
        0.03,
        0.97,
    )
    if probability >= HIGH_AT:
        risk_level = "HIGH"
    elif probability >= MODERATE_AT:
        risk_level = "MODERATE"
    else:
        risk_level = "LOW"

    spread = float(redness.max() - np.quantile(redness, 0.50))
    confidence = _clip(0.50 + 0.45 * spread, 0.50, 0.92)

    attention = np.maximum(redness, yellow)
    attention = np.clip(attention - float(np.median(attention)), 0, None)
    peak = float(attention.max())
    if peak > 1e-6:
        attention = attention / peak

    drivers = [
        {
            "name": "Redness",
            "value": round(redness_score, 4),
            "note": "How red the strongest area is, compared with nearby skin.",
        },
        {
            "name": "Red area",
            "value": round(_clip(hot_fraction * 5.0, 0, 1), 4),
            "note": "How much of the photo carries a strong red signal.",
        },
        {
            "name": "Yellow signal",
            "value": round(exudate_score, 4),
            "note": "Pale yellow areas, a visual stand-in for drainage. Not a lab result.",
        },
    ]
    return InferenceResult(
        risk_level=risk_level,
        probability=round(probability, 4),
        confidence=round(confidence, 4),
        drivers=drivers,
        summary=SUMMARIES[risk_level],
        method="visual-attention-v1",
        attention=attention.astype(np.float32),
    )


def infer(image: Image.Image) -> InferenceResult:
    from .trained import infer_trained, model_ready

    if model_ready():
        return infer_trained(image)
    return infer_visual(image)
