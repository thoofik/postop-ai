"""SurgWound infection-risk model and a real Grad-CAM map from its last features."""

import os

import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

from ..config import BASE_DIR
from .inference import InferenceResult, _clip

CHECKPOINT = BASE_DIR / "models" / "wound_risk.pt"
SUMMARIES = {
    "LOW": "EfficientNet placed this photograph in the low risk band.",
    "MODERATE": "EfficientNet placed this photograph in the moderate risk band.",
    "HIGH": "EfficientNet placed this photograph in the high risk band.",
}

_model = None
_transform = None
_classes: list[str] | None = None
_ready: bool | None = None


def model_ready() -> bool:
    global _ready
    if os.environ.get("POSTOP_DISABLE_MODEL") == "1":
        return False
    if _ready is not None:
        return _ready
    if not CHECKPOINT.is_file():
        _ready = False
        return False
    blob = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
    _ready = blob.get("architecture") == "efficientnet_b0"
    return _ready


def _load():
    global _model, _transform, _classes
    if _model is not None:
        return _model, _transform, _classes
    blob = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
    classes = list(blob["classes"])
    if blob.get("architecture") != "efficientnet_b0":
        raise RuntimeError("The saved risk model is not EfficientNet-B0.")
    weights = EfficientNet_B0_Weights.DEFAULT
    network = efficientnet_b0(weights=None)
    network.classifier[1] = nn.Linear(network.classifier[1].in_features, len(classes))
    network.load_state_dict(blob["state_dict"])
    network.eval()
    _model = network
    _transform = weights.transforms()
    _classes = classes
    return _model, _transform, _classes


def _grad_cam(network: nn.Module, batch: torch.Tensor, class_index: int) -> np.ndarray:
    features = network.features
    captured: dict[str, torch.Tensor] = {}

    def save_activation(_module, _inputs, output):
        captured["activation"] = output

    def save_gradient(_module, _grad_in, grad_out):
        captured["gradient"] = grad_out[0]

    forward_hook = features.register_forward_hook(save_activation)
    backward_hook = features.register_full_backward_hook(save_gradient)
    try:
        logits = network(batch)
        network.zero_grad(set_to_none=True)
        logits[0, class_index].backward()
        activation = captured["activation"][0]
        gradient = captured["gradient"][0]
        weights = gradient.mean(dim=(1, 2))
        cam = torch.relu((weights[:, None, None] * activation).sum(dim=0))
        peak = float(cam.max())
        if peak > 1e-6:
            cam = cam / peak
        return cam.detach().cpu().numpy().astype(np.float32)
    finally:
        forward_hook.remove()
        backward_hook.remove()


def infer_trained(image: Image.Image) -> InferenceResult:
    network, transform, classes = _load()
    batch = transform(image.convert("RGB")).unsqueeze(0)
    batch.requires_grad_(True)
    with torch.no_grad():
        logits = network(batch)
        probabilities = torch.softmax(logits, dim=1)[0]
    class_index = int(probabilities.argmax())
    risk_level = classes[class_index]
    low = float(probabilities[classes.index("LOW")]) if "LOW" in classes else 0.0
    moderate = float(probabilities[classes.index("MODERATE")]) if "MODERATE" in classes else 0.0
    high = float(probabilities[classes.index("HIGH")]) if "HIGH" in classes else 0.0
    concern = _clip(0.2 * low + 0.55 * moderate + 0.92 * high, 0.03, 0.97)
    attention = _grad_cam(network, batch, class_index)
    drivers = [
        {
            "name": "Low risk",
            "value": round(low, 4),
            "note": "Model probability for the low infection-risk band.",
        },
        {
            "name": "Moderate risk",
            "value": round(moderate, 4),
            "note": "Model probability for the moderate infection-risk band.",
        },
        {
            "name": "High risk",
            "value": round(high, 4),
            "note": "Model probability for the high infection-risk band.",
        },
    ]
    return InferenceResult(
        risk_level=risk_level,
        probability=round(concern, 4),
        confidence=round(_clip(float(probabilities[class_index]), 0.35, 0.93), 4),
        drivers=drivers,
        summary=SUMMARIES.get(risk_level, "Scored by the SurgWound risk model."),
        method="efficientnet-b0-surgwound",
        attention=attention,
    )
