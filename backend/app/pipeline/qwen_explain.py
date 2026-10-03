"""Qwen2.5-VL explanation engine.

Turns the EfficientNet risk score plus wound, symptom, and surgery details
into four clinical-screening sections. Weights live in models/Qwen2.5-VL-7B-Instruct.
"""

import json
import threading
from pathlib import Path

import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = ROOT / "models" / "Qwen2.5-VL-7B-Instruct"

_model = None
_processor = None
_lock = threading.Lock()


def weights_ready() -> bool:
    index = MODEL_DIR / "model.safetensors.index.json"
    if not (MODEL_DIR / "config.json").is_file() or not index.is_file():
        return False
    names = set(json.loads(index.read_text(encoding="utf-8"))["weight_map"].values())
    return bool(names) and all((MODEL_DIR / name).is_file() for name in names)


def _load():
    global _model, _processor
    if _model is not None:
        return _model, _processor
    from transformers import AutoProcessor, BitsAndBytesConfig, Qwen2_5_VLForConditionalGeneration

    quant = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )
    _processor = AutoProcessor.from_pretrained(MODEL_DIR, local_files_only=True)
    _processor.image_processor.max_pixels = 768 * 768
    _model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_DIR,
        quantization_config=quant,
        device_map="cuda:0",
        local_files_only=True,
        low_cpu_mem_usage=True,
    )
    _model.eval()
    return _model, _processor


_LANG = {
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
}


def _prompt(context: dict, risk_level: str, probability: float, language: str = "en") -> str:
    symptoms = ", ".join(context.get("symptoms") or []) or "none reported"
    return f"""You are a post-operative wound screening assistant. You are not making a diagnosis.
Wound site: {context.get("wound_site") or "unspecified"}
Days after surgery: {context.get("days_post_op") if context.get("days_post_op") is not None else "unspecified"}
Procedure: {context.get("procedure") or "unspecified"}
Symptoms reported: {symptoms}
EfficientNet risk band: {risk_level}
Concern probability: {probability:.1%}

Look at the wound photograph and reply with only JSON using these keys:
what_the_model_saw, risk_explanation, next_step_guidance, warning_signs.
Keep each value to two sentences. Do not claim an infection is present.
Write every JSON value only in {_LANG.get(language, "English")}. Do not write the values in English unless the language is English. Keep the JSON keys in English.
"""


def explain_image(image: Image.Image, context: dict, risk_level: str, probability: float, language: str = "en") -> dict:
    if not weights_ready():
        raise FileNotFoundError(
            "Qwen2.5-VL weights are still downloading into models/Qwen2.5-VL-7B-Instruct."
        )
    with _lock:
        model, processor = _load()
        return _generate(model, processor, image, context, risk_level, probability, language)


def _generate(model, processor, image: Image.Image, context: dict, risk_level: str, probability: float, language: str = "en") -> dict:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": _prompt(context, risk_level, probability or 0, language)},
            ],
        }
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    photo = image.convert("RGB")
    photo.thumbnail((768, 768))
    batch = processor(text=[text], images=[photo], return_tensors="pt")
    batch = batch.to(model.device)
    with torch.no_grad():
        generated = model.generate(**batch, max_new_tokens=360)
    trimmed = generated[:, batch["input_ids"].shape[1] :]
    raw = processor.batch_decode(trimmed, skip_special_tokens=True)[0].strip()
    start = raw.find("{")
    end = raw.rfind("}")
    parsed = json.loads(raw[start : end + 1]) if start >= 0 and end > start else {}
    return {
        "what_the_model_saw": str(parsed.get("what_the_model_saw") or raw[:400]),
        "risk_explanation": str(parsed.get("risk_explanation") or ""),
        "next_step_guidance": str(parsed.get("next_step_guidance") or ""),
        "warning_signs": str(parsed.get("warning_signs") or ""),
        "engine": "Qwen2.5-VL-7B-Instruct",
        "language": language if language in _LANG or language == "en" else "en",
    }
