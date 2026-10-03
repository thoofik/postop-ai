export type RiskLevel = "HIGH" | "MODERATE" | "LOW";

export type QualityCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  advice: string;
};

export type Assessment = {
  id: string;
  created_at: string;
  patient_label: string;
  wound_site: string;
  days_post_op: number | null;
  saved: boolean;
  sample: boolean;
  image_url: string;
  heatmap_url: string | null;
  overlay_url: string | null;
  quality: {
    passed: boolean;
    width: number;
    height: number;
    blur_score: number;
    brightness: number;
    checks: QualityCheck[];
  };
  risk_level: RiskLevel | null;
  probability: number | null;
  confidence: number | null;
  drivers: { name: string; value: number; note: string }[];
  summary: string | null;
  method: string | null;
  context?: {
    wound_site?: string;
    days_post_op?: number | null;
    procedure?: string;
    symptoms?: string[];
  };
  explanation?: {
    what_the_model_saw: string;
    risk_explanation: string;
    next_step_guidance: string;
    warning_signs: string;
    engine: string;
    language?: string;
  } | null;
};

export type CompareResult = {
  current: Assessment;
  previous: Assessment;
  delta_probability: number;
  direction: "improving" | "worsening" | "stable";
};

export type Trend = {
  patient_label: string;
  points: {
    id: string;
    created_at: string;
    days_post_op: number | null;
    risk_level: RiskLevel;
    probability: number;
    confidence: number;
  }[];
};

export type Profile = {
  patient_label: string;
  wound_site: string;
  days_post_op: string;
  procedure: string;
  symptoms: string[];
};
