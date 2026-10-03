"""PostOp AI API.

The phone walks 12 steps. These routes are the ones that do work:
quality, scoring, save, compare, trend, and the printed report.
"""

import threading
import uuid
from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError

from . import db
from .config import MEDIA_DIR, ensure_dirs
from .pipeline.explain import render_explanation
from .pipeline.inference import infer
from .pipeline.quality import check_quality
from .pipeline.synthetic import demo_series, synthetic_wound
from .reports import render_report
from .schemas import AssessmentOut, CompareOut, TrendOut

MAX_BYTES = 12 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000

_run_guard = threading.Lock()
_run_locks: dict[str, threading.Lock] = {}


def _lock_for(assessment_id: str) -> threading.Lock:
    with _run_guard:
        lock = _run_locks.get(assessment_id)
        if lock is None:
            lock = threading.Lock()
            _run_locks[assessment_id] = lock
        return lock


def _clean(value: str, fallback: str, limit: int = 80) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        return fallback
    return cleaned[:limit]


def _days(raw: str) -> int | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Days after surgery should be a whole number.") from exc
    if value < 0 or value > 3650:
        raise HTTPException(status_code=400, detail="Days after surgery looks out of range.")
    return value


def _load_image(payload: bytes) -> Image.Image:
    if len(payload) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That photograph is larger than 12 MB.")
    try:
        opened = Image.open(BytesIO(payload))
        image = ImageOps.exif_transpose(opened)
        if image is None:
            image = opened
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not read that photograph. Use JPEG, PNG, or WebP.",
        ) from exc
    image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
    return image


def _store_photo(image: Image.Image, assessment_id: str) -> str:
    name = f"{assessment_id}.jpg"
    image.save(MEDIA_DIR / name, "JPEG", quality=90)
    return name


def _score(assessment_id: str) -> dict:
    current = db.get_assessment(assessment_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if not current["quality"]["passed"]:
        raise HTTPException(status_code=409, detail="Retake the photo. This one did not pass the quality check.")
    if current["risk_level"]:
        return current

    image = Image.open(MEDIA_DIR / f"{assessment_id}.jpg").convert("RGB")
    result = infer(image)
    heatmap, overlay = render_explanation(image, result.attention)
    heatmap_name = f"{assessment_id}_heat.png"
    overlay_name = f"{assessment_id}_overlay.jpg"
    heatmap.save(MEDIA_DIR / heatmap_name, "PNG", optimize=True)
    overlay.save(MEDIA_DIR / overlay_name, "JPEG", quality=90)
    return db.update_inference(
        assessment_id,
        heatmap_name=heatmap_name,
        overlay_name=overlay_name,
        risk_level=result.risk_level,
        probability=result.probability,
        confidence=result.confidence,
        drivers=result.drivers,
        summary=result.summary,
        method=result.method,
    )


def _direction(delta: float) -> str:
    if abs(delta) < 0.03:
        return "stable"
    if delta < 0:
        return "improving"
    return "worsening"


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dirs()
    db.init_db()
    yield


app = FastAPI(title="PostOp AI", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "postop-ai"}


@app.post("/api/quality", response_model=AssessmentOut, tags=["4 Quality"])
async def create_quality_check(
    image: UploadFile = File(...),
    patient_label: str = Form(""),
    wound_site: str = Form(""),
    days_post_op: str = Form(""),
    procedure: str = Form(""),
    symptoms: str = Form(""),
) -> dict:
    payload = await image.read()
    photo = _load_image(payload)
    assessment_id = str(uuid.uuid4())
    image_name = _store_photo(photo, assessment_id)
    quality = check_quality(photo).to_dict()
    return db.insert_draft(
        assessment_id=assessment_id,
        patient_label=_clean(patient_label, "My recovery"),
        wound_site=_clean(wound_site, "Incision"),
        days_post_op=_days(days_post_op),
        image_name=image_name,
        quality=quality,
        context={
            "wound_site": _clean(wound_site, "Incision"),
            "days_post_op": _days(days_post_op),
            "procedure": _clean(procedure, "Unspecified procedure", limit=120),
            "symptoms": [part.strip() for part in symptoms.split(",") if part.strip()][:8],
        },
    )


@app.post("/api/assessments/{assessment_id}/run", response_model=AssessmentOut, tags=["5-8 AI"])
def run_assessment(assessment_id: str) -> dict:
    with _lock_for(assessment_id):
        return _score(assessment_id)


@app.post("/api/assessments/{assessment_id}/explain", response_model=AssessmentOut, tags=["Explanation"])
def explain_assessment(assessment_id: str, language: str = Query("en")) -> dict:
    current = db.get_assessment(assessment_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if not current["risk_level"]:
        raise HTTPException(status_code=409, detail="Score the photograph before asking for an explanation.")
    language = language if language in {"en", "hi", "ta", "te", "kn", "ml"} else "en"
    saved = current.get("explanation") or {}
    if saved and saved.get("language", "en") == language:
        return current
    from .pipeline.qwen_explain import explain_image

    image = Image.open(MEDIA_DIR / f"{assessment_id}.jpg").convert("RGB")
    try:
        explanation = explain_image(
            image,
            current.get("context") or {},
            current["risk_level"],
            current["probability"] or 0,
            language,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Qwen2.5-VL could not write the explanation. {exc}") from exc
    updated = db.update_explanation(assessment_id, explanation)
    if updated is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return updated


@app.post("/api/assessments/{assessment_id}/save", response_model=AssessmentOut, tags=["9 Save"])
def save_assessment(assessment_id: str) -> dict:
    saved = db.mark_saved(assessment_id)
    if saved is None:
        current = db.get_assessment(assessment_id)
        if current is None:
            raise HTTPException(status_code=404, detail="Assessment not found.")
        raise HTTPException(status_code=409, detail="Score the photograph before saving it.")
    return saved


@app.get("/api/assessments", response_model=list[AssessmentOut], tags=["10 Compare"])
def list_assessments(patient_label: str = "") -> list[dict]:
    return db.list_saved(patient_label.strip() or None)


@app.get("/api/assessments/{assessment_id}", response_model=AssessmentOut)
def read_assessment(assessment_id: str) -> dict:
    current = db.get_assessment(assessment_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return current


@app.get("/api/compare", response_model=CompareOut, tags=["10 Compare"])
def compare(current_id: str, previous_id: str) -> dict:
    current = db.get_assessment(current_id)
    previous = db.get_assessment(previous_id)
    if current is None or previous is None:
        raise HTTPException(status_code=404, detail="One of those assessments was not found.")
    if current["probability"] is None or previous["probability"] is None:
        raise HTTPException(status_code=409, detail="Both photographs need a risk score before they can be compared.")
    delta = round(current["probability"] - previous["probability"], 4)
    return {
        "current": current,
        "previous": previous,
        "delta_probability": delta,
        "direction": _direction(delta),
    }


@app.get("/api/trend", response_model=TrendOut, tags=["11 Trend"])
def trend(patient_label: str = "") -> dict:
    label = patient_label.strip()
    rows = [
        item
        for item in db.list_saved(label or None)
        if item["probability"] is not None and item["risk_level"] and item["confidence"] is not None
    ]
    rows.reverse()
    return {
        "patient_label": label,
        "points": [
            {
                "id": item["id"],
                "created_at": item["created_at"],
                "days_post_op": item["days_post_op"],
                "risk_level": item["risk_level"],
                "probability": item["probability"],
                "confidence": item["confidence"],
            }
            for item in rows
        ],
    }


@app.get("/api/assessments/{assessment_id}/report", response_class=HTMLResponse, tags=["12 Report"])
def assessment_report(assessment_id: str) -> HTMLResponse:
    current = db.get_assessment(assessment_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    history = db.list_saved(current["patient_label"])
    return HTMLResponse(render_report(current, history))


@app.post("/api/demo/seed", response_model=list[AssessmentOut], tags=["Demo"])
def seed_demo() -> list[dict]:
    label = "Demo patient"
    db.delete_patient(label)
    created: list[dict] = []
    for spec in demo_series():
        photo = synthetic_wound(spec["kind"], spec["seed"])
        assessment_id = str(uuid.uuid4())
        image_name = _store_photo(photo, assessment_id)
        draft = db.insert_draft(
            assessment_id=assessment_id,
            patient_label=label,
            wound_site="Abdominal incision",
            days_post_op=spec["days_post_op"],
            image_name=image_name,
            quality=check_quality(photo).to_dict(),
            sample=True,
            created_at=spec["created_at"],
        )
        if not draft["quality"]["passed"]:
            raise HTTPException(status_code=500, detail="Demo photograph failed the quality check.")
        scored = _score(assessment_id)
        saved = db.mark_saved(assessment_id)
        created.append(saved or scored)
    return created


ensure_dirs()
db.init_db()
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
