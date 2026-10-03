import type { ReactNode } from "react";
import {
  Activity,
  CircleHelp,
  ClipboardPlus,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";
import { pct, riskClass } from "./format";
import { useLang } from "./i18n";
import { STEPS, type ScreenId } from "./steps";
import type { RiskLevel } from "./types";

export type NavId = "dashboard" | "assess" | "history" | "trend" | "insights" | "reports" | "settings" | "help";

const NAV: { id: NavId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "assess", label: "Assess wound", icon: ClipboardPlus },
  { id: "history", label: "Assessments", icon: History },
  { id: "trend", label: "Recovery trend", icon: Activity },
  { id: "insights", label: "AI insights", icon: Sparkles },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: CircleHelp },
];

export function navForScreen(screen: ScreenId | "history" | "settings" | "help" | "details"): NavId {
  if (screen === "home") return "dashboard";
  if (screen === "history") return "history";
  if (screen === "settings") return "settings";
  if (screen === "help") return "help";
  if (screen === "trend") return "trend";
  if (screen === "compare") return "insights";
  if (screen === "report") return "reports";
  return "assess";
}

export function AppNav({
  current,
  onNavigate,
}: {
  current: NavId;
  onNavigate: (id: NavId) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>PostOp</span>
        <strong>AI</strong>
      </div>
      <p className="side-kicker">
        Wound screening
        <span>Recovery monitor</span>
      </p>
      <nav className="product-nav" aria-label="Primary">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.id === current;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "nav-item on" : "nav-item"}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <p className="fine">Prototype only. This does not diagnose infection or replace your surgical team.</p>
    </aside>
  );
}

export function MobileNav({ current, onNavigate }: { current: NavId; onNavigate: (id: NavId) => void }) {
  const items = NAV.filter((item) => ["dashboard", "assess", "history", "trend"].includes(item.id));
  return (
    <nav className="bottom-nav" aria-label="Mobile">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === current;
        return (
          <button key={item.id} type="button" className={active ? "on" : ""} onClick={() => onNavigate(item.id)}>
            <Icon size={18} aria-hidden="true" />
            <span>{item.id === "dashboard" ? "Home" : item.id === "assess" ? "Assess" : item.id === "history" ? "History" : "Trend"}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function WizardBar({ screen }: { screen: ScreenId | "history" | "settings" | "help" | "details" }) {
  const order = ["details", "capture", "upload", "quality", "processing", "risk", "confidence", "explain", "save"] as const;
  const index = order.indexOf(screen as (typeof order)[number]);
  const phase = index < 0 ? 0 : index <= 0 ? 0 : index <= 2 ? 1 : index <= 4 ? 2 : 3;
  const { t } = useLang();
  const labels = [t("details"), t("photo"), t("analysis"), t("results")];
  if (index < 0) return null;
  return (
    <ol className="wizard" aria-label="Assessment progress">
      {labels.map((label, step) => (
        <li key={step} className={step < phase ? "done" : step === phase ? "now" : ""}>
          <span>{String(step + 1).padStart(2, "0")}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  const mark = level === "HIGH" ? "!" : level === "MODERATE" ? "!" : level === "LOW" ? "✓" : "–";
  return <span className={`pill ${riskClass(level)}`}>{mark} {level ?? "UNSCORED"}</span>;
}

export function StepRail({ current }: { current: ScreenId }) {
  const step = STEPS.find((item) => item.id === current) ?? STEPS[0];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>PostOp</span>
        <strong>AI</strong>
      </div>
      <p className="side-kicker">
        Step {String(step.n).padStart(2, "0")}
        <span>{step.title}</span>
      </p>
      <ol className="steps">
        {STEPS.map((item) => (
          <li key={item.id} className={item.n < step.n ? "done" : item.n === step.n ? "now" : ""}>
            <span className="num" aria-hidden="true" />
            <span>{item.title}</span>
          </li>
        ))}
      </ol>
      <p className="fine">Prototype only. This does not diagnose infection or replace your surgical team.</p>
    </aside>
  );
}

export function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  return (
    <div className="meter-block">
      <div className="meter-top">
        <span>{label}</span>
        <strong>{pct(value)}</strong>
      </div>
      <div className="track" aria-hidden="true">
        <span style={{ width }} />
      </div>
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}

export function RiskHero({ level }: { level: RiskLevel }) {
  return (
    <div className={`risk-hero ${riskClass(level)}`}>
      <span className="kicker">Visual risk band</span>
      <strong className="risk-word">{level}</strong>
    </div>
  );
}

export function ContextLine({
  patient,
  site,
  day,
}: {
  patient: string;
  site: string;
  day: number | null;
}) {
  const dayText = day == null ? "day not set" : `day ${day}`;
  return (
    <p className="context">
      {patient} · {site} · {dayText}
    </p>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}
