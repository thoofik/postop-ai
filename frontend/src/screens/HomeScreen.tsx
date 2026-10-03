import { useState } from "react";
import { motion } from "motion/react";
import HeroSectionOne from "@/components/hero-section-demo-1";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { MacbookScroll } from "@/components/ui/macbook-scroll";
import SwipeRow from "@/components/SwipeRow";
import { Activity, ClipboardPlus, FileText, History, Sparkles, CircleHelp } from "lucide-react";
import { RiskBadge, type NavId } from "../components";
import { formatWhen, pct } from "../format";
import { RiskChart } from "../RiskChart";
import type { Assessment, Profile } from "../types";
import { useLang } from "../i18n";

const SITES = ["Incision", "Abdomen", "Chest", "Knee", "Leg", "Arm", "Other"];
const SYMPTOMS = ["Pain", "Fever", "Drainage", "Swelling", "Spreading redness"];

export function HomeScreen({
  history,
  onStart,
  onOpen,
  onTrend,
  onNavigate,
}: {
  history: Assessment[];
  onStart: () => void;
  onOpen: (assessment: Assessment) => void;
  onTrend: () => void;
  onNavigate: (id: NavId) => void;
}) {
  const { t } = useLang();
  const scored = history.filter((item) => item.saved && item.risk_level && item.probability != null);
  const latest = scored[0];
  const previous = scored[1];
  const delta =
    latest && previous && latest.probability != null && previous.probability != null
      ? (latest.probability - previous.probability) * 100
      : null;

  return (
    <>
      <header className="site-header">
        <div className="site-logo">
          <span className="logo-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          PostOp AI
        </div>
      </header>
      <div className="hero-row">
        <div className="dash-logo">
          <h1 className="hero-title">
            {t("title").split(" ").map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1, ease: "easeInOut" }}
                className="mr-2 inline-block"
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <LayoutTextFlip
            text=""
            words={[t("flipPhoto"), t("flipScore"), t("flipTrend")]}
            duration={2200}
          />
          <p className="hero-copy">{t("blurb")}</p>
          <div className="hero-actions">
            <button className="hero-btn solid" type="button" onClick={onStart}>
              {t("start")}
            </button>
            <button className="hero-btn" type="button" onClick={onTrend}>
              {t("viewTrend")}
            </button>
          </div>
          <HeroSectionOne />
        </div>
      </div>
      <div className="beside-card">
        <section className="portal-grid">
          <h2>{t("portalTitle")}</h2>
          <p>{t("portalLead")}</p>
          <div>
            <button type="button" onClick={onStart}>
              <ClipboardPlus size={18} />
              <b>{t("cardAssess")}</b>
              <span>{t("cardAssessBody")}</span>
              <em>{t("ctaAssess")}</em>
            </button>
            <button type="button" onClick={() => onNavigate("history")}>
              <History size={18} />
              <b>{t("cardHistory")}</b>
              <span>{t("cardHistoryBody")}</span>
              <em>{t("ctaHistory")}</em>
            </button>
            <button type="button" onClick={onTrend}>
              <Activity size={18} />
              <b>{t("cardTrend")}</b>
              <span>{t("cardTrendBody")}</span>
              <em>{t("ctaTrend")}</em>
            </button>
            <button type="button" onClick={() => onNavigate("insights")}>
              <Sparkles size={18} />
              <b>{t("cardCompare")}</b>
              <span>{t("cardCompareBody")}</span>
              <em>{t("ctaCompare")}</em>
            </button>
            <button type="button" onClick={() => onNavigate("reports")}>
              <FileText size={18} />
              <b>{t("cardReport")}</b>
              <span>{t("cardReportBody")}</span>
              <em>{t("ctaReport")}</em>
            </button>
            <button type="button" onClick={() => onNavigate("help")}>
              <CircleHelp size={18} />
              <b>{t("cardLimit")}</b>
              <span>{t("cardLimitBody")}</span>
              <em>{t("ctaLimit")}</em>
            </button>
          </div>
        </section>
        <section className="laptop-card">
          <div className="lap-slot">
            <MacbookScroll src="/laptop-screen.svg?v=5" showGradient={false} />
          </div>
        </section>
      </div>
      <div className="dash-grid">
        <section className="dash-card risk-panel">
          <p className="kicker">{t("currentRisk")}</p>
          {latest ? (
            <>
              <RiskBadge level={latest.risk_level} />
              <strong className="dash-figure">{pct(latest.probability)}</strong>
              <div className="gauge" aria-hidden="true">
                <span style={{ width: `${Math.round((latest.probability ?? 0) * 100)}%` }} />
              </div>
              <p className="muted">
                {delta == null
                  ? t("saveAnother")
                  : `${Math.abs(delta).toFixed(1)} percentage-point ${delta > 0 ? "increase" : delta < 0 ? "decrease" : "change"} from the previous saved assessment.`}
              </p>
            </>
          ) : (
            <Empty onStart={onStart} />
          )}
        </section>
        <section className="dash-card">
          <p className="kicker">{t("latestAssessment")}</p>
          {latest ? (
            <button type="button" className="latest-row" onClick={() => onOpen(latest)}>
              <img src={latest.image_url} alt="" />
              <span>
                <b>{latest.wound_site}</b>
                <span>{formatWhen(latest.created_at)}</span>
                <span>{pct(latest.probability)}</span>
              </span>
            </button>
          ) : (
            <p className="muted">{t("noSaved")}</p>
          )}
        </section>
        <section className="dash-card span-2">
          <p className="kicker">{t("recoveryOverview")}</p>
          <MiniTrend points={[...scored].reverse()} onOpen={onTrend} />
        </section>
        <section className="dash-card span-2">
          <p className="kicker">{t("recentAssessments")}</p>
          {scored.length === 0 ? (
            <Empty onStart={onStart} />
          ) : (
            <div className="assess-cards">
              {scored.slice(0, 4).map((item) => (
                <button key={item.id} type="button" className="assess-card" onClick={() => onOpen(item)}>
                  <img src={item.image_url} alt="" />
                  <b>{item.wound_site}</b>
                  <span>{formatWhen(item.created_at)}</span>
                  <RiskBadge level={item.risk_level} />
                  <span>{pct(item.probability)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Empty({ onStart }: { onStart: () => void }) {
  const { t } = useLang();
  return (
    <div className="empty">
      <b>{t("noneYet")}</b>
      <p>{t("noneLead")}</p>
      <button className="btn primary" type="button" onClick={onStart}>
        {t("startShort")}
      </button>
    </div>
  );
}

function MiniTrend({ points, onOpen }: { points: Assessment[]; onOpen: () => void }) {
  const { t } = useLang();
  const recent = points
    .filter((point) => point.probability != null && point.risk_level)
    .slice(-8)
    .map((point) => ({
      id: point.id,
      created_at: point.created_at,
      probability: point.probability ?? 0,
      risk_level: point.risk_level ?? "LOW",
    }));
  if (recent.length === 0) return <p className="muted">{t("chartEmpty")}</p>;
  return (
    <button type="button" className="mini-chart" onClick={onOpen}>
      <RiskChart points={recent} />
    </button>
  );
}

export function DetailsScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (profile: Profile) => void;
}) {
  const { t } = useLang();
  const [patientLabel, setPatientLabel] = useState("");
  const [woundSite, setWoundSite] = useState("Incision");
  const [otherSite, setOtherSite] = useState("");
  const [daysPostOp, setDaysPostOp] = useState("3");
  const [procedure, setProcedure] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      className="card list"
      onSubmit={(event) => {
        event.preventDefault();
        if (!daysPostOp.trim()) {
          setFormError("Enter the number of days after surgery.");
          return;
        }
        setFormError(null);
        onContinue({
          patient_label: patientLabel.trim() || "My recovery",
          wound_site: woundSite === "Other" ? otherSite.trim() || "Other" : woundSite,
          days_post_op: daysPostOp.trim(),
          procedure: procedure.trim(),
          symptoms,
        });
      }}
    >
      <h1>{t("detailsTitle")}</h1>
      <p className="lede">{t("detailsLead")}</p>
      {formError ? <p className="alert">{formError}</p> : null}
      <label className="field">
        {t("patientLabel")}
        <input value={patientLabel} placeholder={t("patientPh")} onChange={(event) => setPatientLabel(event.target.value)} />
      </label>
      <div className="field">
        {t("woundSite")}
        <div className="site-grid">
          {SITES.map((site) => (
            <button
              key={site}
              type="button"
              className={site === woundSite ? "chip on" : "chip"}
              aria-pressed={site === woundSite}
              onClick={() => setWoundSite(site)}
            >
              {site}
            </button>
          ))}
        </div>
      </div>
      {woundSite === "Other" ? (
        <label className="field">
          Site name
          <input value={otherSite} onChange={(event) => setOtherSite(event.target.value)} />
        </label>
      ) : null}
      <label className="field">
        {t("procedure")}
        <input
          value={procedure}
          placeholder={t("procedurePh")}
          onChange={(event) => setProcedure(event.target.value)}
        />
      </label>
      <div className="field">
        {t("symptoms")}
        <div className="site-grid">
          {SYMPTOMS.map((symptom) => {
            const on = symptoms.includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                className={on ? "chip on" : "chip"}
                aria-pressed={on}
                onClick={() =>
                  setSymptoms((current) =>
                    current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom],
                  )
                }
              >
                {on ? "Selected · " : "Not selected · "}
                {symptom}
              </button>
            );
          })}
        </div>
      </div>
      <label className="field">
        {t("days")}
        <input
          inputMode="numeric"
          value={daysPostOp}
          onChange={(event) => setDaysPostOp(event.target.value.replace(/[^\d]/g, ""))}
        />
      </label>
      <div className="actions">
        <button className="btn primary" type="submit">
          {t("continuePhoto")}
        </button>
        <button className="btn" type="button" onClick={onBack}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

export function HistoryScreen({
  history,
  notice,
  busy,
  onOpen,
  onSeed,
  onStart,
}: {
  history: Assessment[];
  notice: string | null;
  busy: boolean;
  onOpen: (assessment: Assessment) => void;
  onSeed: () => void;
  onStart: () => void;
}) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = history.filter((item) => {
    const text = `${item.patient_label} ${item.wound_site}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (risk !== "ALL" && item.risk_level !== risk) return false;
    if (hidden.includes(item.id)) return false;
    return true;
  });
  return (
    <>
      <h1>{t("assessments")}</h1>
      <div className="filters">
        <input value={query} placeholder={t("searchPh")} onChange={(event) => setQuery(event.target.value)} />
        <select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Risk filter">
          <option value="ALL">{t("allRisks")}</option>
          <option value="LOW">LOW</option>
          <option value="MODERATE">MODERATE</option>
          <option value="HIGH">HIGH</option>
        </select>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
      {rows.length === 0 ? (
        <div className="empty">
          <b>{t("noneYet")}</b>
          <p>{t("noneLead")}</p>
          <button className="btn primary" type="button" onClick={onStart}>
            {t("startShort")}
          </button>
        </div>
      ) : (
        <div className="history-cards">
          {rows.map((item) => (
            <SwipeRow
              key={item.id}
              label={item.wound_site}
              height={300}
              rowColor="#000000"
              textColor="#f5f5f5"
              drawerColor="#111111"
              onAction={() => setHidden((ids) => [...ids, item.id])}
            >
              <button type="button" className="assess-card" onClick={() => onOpen(item)}>
                <img src={item.image_url} alt="" />
                <b>
                  {item.wound_site}
                  {item.sample ? " · Sample" : ""}
                </b>
                <span>
                  {item.patient_label} · {formatWhen(item.created_at)}
                </span>
                <RiskBadge level={item.risk_level} />
                <span>{pct(item.probability)}</span>
              </button>
            </SwipeRow>
          ))}
        </div>
      )}
      <button className="btn" type="button" disabled={busy} onClick={onSeed}>
        {busy ? "Building sample timeline…" : "Load sample timeline"}
      </button>
    </>
  );
}

export function InfoScreen({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{body}</p>
    </>
  );
}
