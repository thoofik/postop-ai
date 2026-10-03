import type { RiskLevel } from "./types";

export function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatChartDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function riskClass(level: RiskLevel | null): string {
  if (level === "HIGH") return "high";
  if (level === "MODERATE") return "moderate";
  if (level === "LOW") return "low";
  return "";
}
