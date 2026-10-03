"""Step 12 — printable assessment report."""

import html
from datetime import datetime, timezone


DISCLAIMER = (
    "PostOp AI is a prototype for demonstration. It is not a medical device, "
    "does not diagnose infection, and does not replace a surgical team. "
    "Seek urgent care for fever, spreading redness, heavy bleeding, or worsening pain."
)

RISK_COLOR = {"HIGH": "#9f1239", "MODERATE": "#c2410c", "LOW": "#166534"}


def _esc(value: object) -> str:
    return html.escape("" if value is None else str(value))


def _pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:.1f}%"


def _sparkline(points: list[dict]) -> str:
    if not points:
        return "<p>No saved timeline yet.</p>"
    width, height, pad = 640, 200, 28
    ordered = list(reversed(points))

    def xy(index: int, probability: float) -> tuple[float, float]:
        span = max(len(ordered) - 1, 1)
        x = pad + (width - 2 * pad) * (index / span)
        y = pad + (height - 2 * pad) * (1 - probability)
        return x, y

    coords = [xy(index, point["probability"]) for index, point in enumerate(ordered)]
    poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)
    dots = []
    labels = []
    for index, point in enumerate(ordered):
        x, y = coords[index]
        color = RISK_COLOR.get(point["risk_level"], "#12382f")
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{color}" />')
        if point["days_post_op"] is None:
            label = ""
        else:
            label = f"D{point['days_post_op']}"
        labels.append(
            f'<text x="{x:.1f}" y="{height - 6}" text-anchor="middle" font-size="12" fill="#5c6b64">{_esc(label)}</text>'
        )
    return f"""
    <svg viewBox="0 0 {width} {height}" role="img" aria-label="Concern probability over time">
      <polyline points="{poly}" fill="none" stroke="#12382f" stroke-width="3" />
      {''.join(dots)}
      {''.join(labels)}
    </svg>
    """


def render_report(current: dict, history: list[dict]) -> str:
    earlier = [
        item
        for item in history
        if item["id"] != current["id"] and item["created_at"] < current["created_at"] and item["probability"] is not None
    ]
    previous = earlier[0] if earlier else None
    timeline = [item for item in history if item["probability"] is not None]
    drivers = "".join(
        f"<li><strong>{_esc(driver['name'])}</strong> — {_pct(driver['value'])}. {_esc(driver['note'])}</li>"
        for driver in current["drivers"]
    ) or "<li>No drivers. The photograph did not pass the quality check.</li>"
    checks = "".join(
        f"<li>{'Pass' if check['passed'] else 'Redo'} — {_esc(check['label'])}: {_esc(check['detail'])}</li>"
        for check in current["quality"]["checks"]
    )
    if previous and previous["probability"] is not None and current["probability"] is not None:
        delta = current["probability"] - previous["probability"]
        points = abs(delta) * 100
        if abs(delta) < 0.03:
            headline = "Risk unchanged"
            arrow = f"{delta * 100:+.1f} pp"
            screening = "The model assigned a similar infection-associated risk to the current image and the previous assessment."
        elif delta > 0:
            headline = "Risk increased"
            arrow = f"↑ +{points:.1f} pp"
            screening = "The model assigned a higher infection-associated risk to the current image than the previous assessment."
        else:
            headline = "Risk decreased"
            arrow = f"↓ −{points:.1f} pp"
            screening = "The model assigned a lower infection-associated risk to the current image than the previous assessment."
        comparison = f"""
        <div class="change">
          <div><span>Previous</span><strong>{_pct(previous["probability"])}</strong><em>{_esc(previous["risk_level"])}</em></div>
          <div><span>Current</span><strong>{_pct(current["probability"])}</strong><em>{_esc(current["risk_level"])}</em></div>
          <p class="arrow">{_esc(arrow)}</p>
          <p class="headline">{_esc(headline)}</p>
        </div>
        <h2>Clinical note</h2>
        <p><strong>AI screening change:</strong> {_esc(screening)}</p>
        <p><strong>Important:</strong> Changes in AI risk do not establish that an infection has developed. Clinical evaluation should be used to determine the cause of wound changes.</p>
        """
    else:
        comparison = "<p>No earlier saved assessment for this patient yet.</p>"

    risk = current["risk_level"] or "Not scored"
    color = RISK_COLOR.get(current["risk_level"], "#12382f")
    sample = "<p class='sample'>Sample photograph generated for the demo timeline.</p>" if current["sample"] else ""
    overlay = (
        f"<img src='{_esc(current['overlay_url'])}' alt='Explanation map over the wound photograph' />"
        if current["overlay_url"]
        else ""
    )
    generated = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    days = "—" if current["days_post_op"] is None else str(current["days_post_op"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PostOp AI assessment report</title>
  <style>
    body {{ margin: 0; font-family: Georgia, "Segoe UI", sans-serif; color: #14221c; background: #f4f7f5; }}
    main {{ max-width: 760px; margin: 0 auto; padding: 32px 22px 64px; background: white; }}
    h1 {{ font-weight: 560; letter-spacing: -0.03em; margin-bottom: 0; }}
    .kicker {{ letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px; color: #5c6b64; }}
    .disclaimer, .sample {{ background: #f4f1ea; padding: 12px 14px; border-radius: 12px; font-size: 14px; line-height: 1.45; }}
    .band {{ font-size: 56px; line-height: 0.9; color: {color}; margin: 8px 0; }}
    .change {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; border: 1px solid #d5e2db; border-radius: 16px; padding: 14px 16px; }}
    .change span {{ display: block; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5c6b64; }}
    .change strong {{ display: block; font-size: 32px; }}
    .change .arrow, .change .headline {{ grid-column: 1 / -1; text-align: center; margin: 0; }}
    .change .headline {{ font-weight: 700; }}
    .facts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }}
    .facts div {{ font-size: 14px; }}
    .photos {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
    img {{ width: 100%; border-radius: 12px; }}
    svg {{ width: 100%; height: auto; }}
    button {{ border: 0; background: #12382f; color: white; border-radius: 999px; padding: 10px 16px; }}
    @media print {{ button {{ display: none; }} body {{ background: white; }} }}
  </style>
</head>
<body>
  <main>
    <p class="kicker">PostOp AI · Assessment report</p>
    <h1>Wound assessment</h1>
    <p class="disclaimer">{DISCLAIMER}</p>
    {sample}
    <p class="band">{_esc(risk)}</p>
    <div class="facts">
      <div><strong>Patient label</strong><br>{_esc(current["patient_label"])}</div>
      <div><strong>Wound site</strong><br>{_esc(current["wound_site"])}</div>
      <div><strong>Days after surgery</strong><br>{_esc(days)}</div>
      <div><strong>Captured</strong><br>{_esc(current["created_at"])}</div>
      <div><strong>Probability</strong><br>{_pct(current["probability"])}</div>
      <div><strong>Confidence</strong><br>{_pct(current["confidence"])}</div>
    </div>
    <p>{_esc(current["summary"] or "This photograph was stored before scoring.")}</p>
    <h2>Photographs</h2>
    <div class="photos">
      <img src="{_esc(current["image_url"])}" alt="Wound photograph" />
      {overlay}
    </div>
    <h2>What moved the score</h2>
    <ul>{drivers}</ul>
    <h2>Image quality</h2>
    <ul>{checks}</ul>
    <h2>Previous assessment</h2>
    {comparison}
    <h2>Risk trend</h2>
    {_sparkline(timeline)}
    <p>Generated {generated}.</p>
    <button type="button" onclick="window.print()">Print or save as PDF</button>
  </main>
</body>
</html>"""
