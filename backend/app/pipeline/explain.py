"""Step 8 — Grad-CAM style localization map.

The map highlights pixels that raised the visual concern score.
A trained network can return its own Grad-CAM tensor here; the overlay
and the phone screen stay the same.
"""

import numpy as np
from PIL import Image, ImageFilter


def _jet_rgba(attention: np.ndarray) -> np.ndarray:
    tone = np.clip(attention, 0, 1)
    red = np.clip(1.5 - np.abs(4 * tone - 3), 0, 1)
    green = np.clip(1.5 - np.abs(4 * tone - 2), 0, 1)
    blue = np.clip(1.5 - np.abs(4 * tone - 1), 0, 1)
    alpha = np.clip((tone - 0.12) / 0.88, 0, 1) ** 0.85
    channels = np.dstack([red, green, blue, alpha * 0.88])
    return (channels * 255).astype(np.uint8)


def _smooth(attention: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    image = Image.fromarray((np.clip(attention, 0, 1) * 255).astype(np.uint8), "L")
    if image.size != size:
        image = image.resize(size, Image.Resampling.BILINEAR)
    radius = max(6, min(size) // 48)
    image = image.filter(ImageFilter.GaussianBlur(radius=radius))
    smoothed = np.asarray(image).astype(np.float32) / 255.0
    smoothed -= smoothed.min()
    peak = float(smoothed.max())
    if peak > 1e-6:
        smoothed /= peak
    return smoothed**1.35


def render_explanation(photo: Image.Image, attention: np.ndarray) -> tuple[Image.Image, Image.Image]:
    smoothed = _smooth(attention, photo.size)
    heatmap = Image.fromarray(_jet_rgba(smoothed), "RGBA")
    overlay = Image.alpha_composite(photo.convert("RGBA"), heatmap).convert("RGB")
    return heatmap, overlay
