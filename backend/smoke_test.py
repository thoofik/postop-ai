"""Pipeline check. Run from the backend folder with the project virtualenv."""

import io
import os
import tempfile
from pathlib import Path

os.environ["POSTOP_DATA"] = tempfile.mkdtemp(prefix="postop-")
os.environ["POSTOP_DISABLE_MODEL"] = "1"

from fastapi.testclient import TestClient
from PIL import Image, ImageFilter

from app.main import app
from app.pipeline.synthetic import synthetic_wound

client = TestClient(app)


def post_photo(image: Image.Image, days: str = "3") -> dict:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    response = client.post(
        "/api/quality",
        files={"image": ("wound.jpg", buffer.getvalue(), "image/jpeg")},
        data={"patient_label": "Smoke patient", "wound_site": "Incision", "days_post_op": days},
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    soft = Image.new("RGB", (800, 800), (180, 140, 130)).filter(ImageFilter.GaussianBlur(radius=12))
    failed = post_photo(soft)
    assert failed["quality"]["passed"] is False
    assert failed["risk_level"] is None
    blocked = client.post(f"/api/assessments/{failed['id']}/run")
    assert blocked.status_code == 409

    scored: dict[str, dict] = {}
    for kind, day in (("high", "2"), ("moderate", "6"), ("low", "11")):
        draft = post_photo(synthetic_wound(kind, seed=20 + len(kind)), days=day)
        assert draft["quality"]["passed"], draft["quality"]
        result = client.post(f"/api/assessments/{draft['id']}/run")
        result.raise_for_status()
        body = result.json()
        scored[kind] = body
        print(kind, body["risk_level"], body["probability"], body["confidence"], body["drivers"])

    assert scored["high"]["probability"] > scored["moderate"]["probability"] > scored["low"]["probability"]
    assert scored["high"]["risk_level"] == "HIGH"
    assert scored["moderate"]["risk_level"] == "MODERATE"
    assert scored["low"]["risk_level"] == "LOW"
    assert scored["high"]["heatmap_url"]

    saved = client.post(f"/api/assessments/{scored['low']['id']}/save")
    saved.raise_for_status()
    earlier = client.post(f"/api/assessments/{scored['high']['id']}/save")
    earlier.raise_for_status()

    compared = client.get(
        "/api/compare",
        params={"current_id": scored["low"]["id"], "previous_id": scored["high"]["id"]},
    )
    compared.raise_for_status()
    assert compared.json()["direction"] == "improving"

    trend = client.get("/api/trend", params={"patient_label": "Smoke patient"})
    trend.raise_for_status()
    assert len(trend.json()["points"]) == 2

    report = client.get(f"/api/assessments/{scored['low']['id']}/report")
    assert report.status_code == 200
    assert "PostOp AI" in report.text
    assert "LOW" in report.text

    seeded = client.post("/api/demo/seed")
    seeded.raise_for_status()
    levels = [item["risk_level"] for item in seeded.json()]
    print("demo", levels, [item["probability"] for item in seeded.json()])
    assert levels == ["HIGH", "MODERATE", "LOW"]
    print("smoke ok", Path(os.environ["POSTOP_DATA"]))


if __name__ == "__main__":
    main()
