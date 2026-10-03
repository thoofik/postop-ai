from typing import Literal

from pydantic import BaseModel, Field


class CheckOut(BaseModel):
    id: str
    label: str
    passed: bool
    detail: str
    advice: str


class QualityOut(BaseModel):
    passed: bool
    width: int
    height: int
    blur_score: float
    brightness: float
    checks: list[CheckOut]


class DriverOut(BaseModel):
    name: str
    value: float
    note: str


class ExplanationOut(BaseModel):
    what_the_model_saw: str
    risk_explanation: str
    next_step_guidance: str
    warning_signs: str
    engine: str
    language: str = "en"


class AssessmentOut(BaseModel):
    id: str
    created_at: str
    patient_label: str
    wound_site: str
    days_post_op: int | None
    saved: bool
    sample: bool
    image_url: str
    heatmap_url: str | None
    overlay_url: str | None
    quality: QualityOut
    risk_level: Literal["HIGH", "MODERATE", "LOW"] | None
    probability: float | None
    confidence: float | None
    drivers: list[DriverOut] = Field(default_factory=list)
    summary: str | None
    method: str | None
    context: dict = Field(default_factory=dict)
    explanation: ExplanationOut | None = None


class CompareOut(BaseModel):
    current: AssessmentOut
    previous: AssessmentOut
    delta_probability: float
    direction: Literal["improving", "worsening", "stable"]


class TrendPoint(BaseModel):
    id: str
    created_at: str
    days_post_op: int | None
    risk_level: Literal["HIGH", "MODERATE", "LOW"]
    probability: float
    confidence: float


class TrendOut(BaseModel):
    patient_label: str
    points: list[TrendPoint]
