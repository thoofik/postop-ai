import json
import sqlite3
import uuid
from datetime import datetime, timezone

from .config import DB_PATH, MEDIA_DIR, ensure_dirs


def connect() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                patient_label TEXT NOT NULL,
                wound_site TEXT NOT NULL,
                days_post_op INTEGER,
                saved INTEGER NOT NULL DEFAULT 0,
                sample INTEGER NOT NULL DEFAULT 0,
                image_name TEXT NOT NULL,
                heatmap_name TEXT,
                overlay_name TEXT,
                quality_json TEXT NOT NULL,
                risk_level TEXT,
                probability REAL,
                confidence REAL,
                drivers_json TEXT,
                summary TEXT,
                method TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_assessments_patient
            ON assessments (patient_label, created_at)
            """
        )
        existing = {row[1] for row in conn.execute("PRAGMA table_info(assessments)")}
        if "context_json" not in existing:
            conn.execute("ALTER TABLE assessments ADD COLUMN context_json TEXT")
        if "explanation_json" not in existing:
            conn.execute("ALTER TABLE assessments ADD COLUMN explanation_json TEXT")


def row_to_dict(row: sqlite3.Row) -> dict:
    heatmap_name = row["heatmap_name"]
    overlay_name = row["overlay_name"]
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "patient_label": row["patient_label"],
        "wound_site": row["wound_site"],
        "days_post_op": row["days_post_op"],
        "saved": bool(row["saved"]),
        "sample": bool(row["sample"]),
        "image_url": f"/media/{row['image_name']}",
        "heatmap_url": f"/media/{heatmap_name}" if heatmap_name else None,
        "overlay_url": f"/media/{overlay_name}" if overlay_name else None,
        "quality": json.loads(row["quality_json"]),
        "risk_level": row["risk_level"],
        "probability": row["probability"],
        "confidence": row["confidence"],
        "drivers": json.loads(row["drivers_json"] or "[]"),
        "summary": row["summary"],
        "method": row["method"],
        "context": json.loads(row["context_json"] or "{}"),
        "explanation": json.loads(row["explanation_json"] or "null"),
    }


def insert_draft(
    *,
    patient_label: str,
    wound_site: str,
    days_post_op: int | None,
    image_name: str,
    quality: dict,
    sample: bool = False,
    created_at: str | None = None,
    assessment_id: str | None = None,
    context: dict | None = None,
) -> dict:
    assessment_id = assessment_id or str(uuid.uuid4())
    created_at = created_at or datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO assessments (
                id, created_at, patient_label, wound_site, days_post_op,
                saved, sample, image_name, quality_json, context_json
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                assessment_id,
                created_at,
                patient_label,
                wound_site,
                days_post_op,
                int(sample),
                image_name,
                json.dumps(quality),
                json.dumps(context or {}),
            ),
        )
    found = get_assessment(assessment_id)
    if found is None:
        raise RuntimeError("Assessment was not stored.")
    return found


def update_inference(
    assessment_id: str,
    *,
    heatmap_name: str,
    overlay_name: str,
    risk_level: str,
    probability: float,
    confidence: float,
    drivers: list[dict],
    summary: str,
    method: str,
) -> dict:
    with connect() as conn:
        conn.execute(
            """
            UPDATE assessments
            SET heatmap_name = ?, overlay_name = ?, risk_level = ?, probability = ?,
                confidence = ?, drivers_json = ?, summary = ?, method = ?
            WHERE id = ?
            """,
            (
                heatmap_name,
                overlay_name,
                risk_level,
                probability,
                confidence,
                json.dumps(drivers),
                summary,
                method,
                assessment_id,
            ),
        )
    found = get_assessment(assessment_id)
    if found is None:
        raise RuntimeError("Assessment disappeared during scoring.")
    return found


def update_explanation(assessment_id: str, explanation: dict) -> dict | None:
    with connect() as conn:
        conn.execute(
            "UPDATE assessments SET explanation_json = ? WHERE id = ?",
            (json.dumps(explanation), assessment_id),
        )
    return get_assessment(assessment_id)


def mark_saved(assessment_id: str) -> dict | None:
    with connect() as conn:
        cursor = conn.execute(
            """
            UPDATE assessments
            SET saved = 1
            WHERE id = ? AND risk_level IS NOT NULL
            """,
            (assessment_id,),
        )
        if cursor.rowcount == 0:
            return None
    return get_assessment(assessment_id)


def get_assessment(assessment_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM assessments WHERE id = ?",
            (assessment_id,),
        ).fetchone()
    return row_to_dict(row) if row else None


def list_saved(patient_label: str | None = None) -> list[dict]:
    with connect() as conn:
        if patient_label:
            rows = conn.execute(
                """
                SELECT * FROM assessments
                WHERE saved = 1 AND patient_label = ?
                ORDER BY created_at DESC
                """,
                (patient_label,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM assessments WHERE saved = 1 ORDER BY created_at DESC"
            ).fetchall()
    return [row_to_dict(row) for row in rows]


def delete_patient(patient_label: str) -> None:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM assessments WHERE patient_label = ?",
            (patient_label,),
        ).fetchall()
        conn.execute("DELETE FROM assessments WHERE patient_label = ?", (patient_label,))
    for row in rows:
        for column in ("image_name", "heatmap_name", "overlay_name"):
            name = row[column]
            if name:
                (MEDIA_DIR / name).unlink(missing_ok=True)
