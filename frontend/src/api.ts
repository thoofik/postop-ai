import type { Assessment, CompareResult, Profile, Trend } from "./types";

async function fail(response: Response): Promise<never> {
  let message = "The server could not finish that step. Try the photo again.";
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") message = data.detail;
  } catch {
    // Keep the fallback when the body is not JSON.
  }
  throw new Error(message);
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) await fail(response);
  return response.json() as Promise<T>;
}

export function checkQuality(file: Blob, profile: Profile): Promise<Assessment> {
  const body = new FormData();
  body.append("image", file, "wound.jpg");
  body.append("patient_label", profile.patient_label);
  body.append("wound_site", profile.wound_site);
  body.append("days_post_op", profile.days_post_op);
  body.append("procedure", profile.procedure);
  body.append("symptoms", profile.symptoms.join(","));
  return fetch("/api/quality", { method: "POST", body }).then(read<Assessment>);
}

export function explainAssessment(id: string, language = "en"): Promise<Assessment> {
  return fetch(`/api/assessments/${id}/explain?language=${encodeURIComponent(language)}`, { method: "POST" }).then(read<Assessment>);
}

export function runAssessment(id: string): Promise<Assessment> {
  return fetch(`/api/assessments/${id}/run`, { method: "POST" }).then(read<Assessment>);
}

export function saveAssessment(id: string): Promise<Assessment> {
  return fetch(`/api/assessments/${id}/save`, { method: "POST" }).then(read<Assessment>);
}

export function listAssessments(patientLabel = ""): Promise<Assessment[]> {
  const query = patientLabel ? `?patient_label=${encodeURIComponent(patientLabel)}` : "";
  return fetch(`/api/assessments${query}`).then(read<Assessment[]>);
}

export function compareAssessments(currentId: string, previousId: string): Promise<CompareResult> {
  const query = new URLSearchParams({ current_id: currentId, previous_id: previousId });
  return fetch(`/api/compare?${query}`).then(read<CompareResult>);
}

export function loadTrend(patientLabel: string): Promise<Trend> {
  const query = new URLSearchParams({ patient_label: patientLabel });
  return fetch(`/api/trend?${query}`).then(read<Trend>);
}

export function seedDemo(): Promise<Assessment[]> {
  return fetch("/api/demo/seed", { method: "POST" }).then(read<Assessment[]>);
}
