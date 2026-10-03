import { useEffect, useState } from "react";
import ElasticSlider from "@/components/ElasticSlider";
import ThoughtLine from "@/components/ThoughtLine";
import { explainAssessment } from "../api";
import { Actions, ContextLine, Meter, RiskHero } from "../components";
import { pct, riskClass } from "../format";
import type { Assessment } from "../types";
import { speechLang, useLang } from "../i18n";

const explainCache = new Map<string, NonNullable<Assessment["explanation"]>>();
const explainInflight = new Map<string, Promise<Assessment>>();

function startExplain(id: string, language = "en"): Promise<Assessment> {
  const key = `${id}:${language}`;
  const existing = explainInflight.get(key);
  if (existing) return existing;
  const job = explainAssessment(id, language)
    .then((updated) => {
      if (updated.explanation) explainCache.set(key, updated.explanation);
      return updated;
    })
    .finally(() => {
      if (explainInflight.get(key) === job) explainInflight.delete(key);
    });
  explainInflight.set(key, job);
  return job;
}

export function RiskScreen({ assessment, onNext }: { assessment: Assessment; onNext: () => void }) {
  const { t } = useLang();
  return (
    <div className="split">
      <div className="frame">
        <img src={assessment.image_url} alt="Scored wound photograph" />
        {assessment.sample ? <span className="sample">Sample photo</span> : null}
      </div>
      <div className="card">
      {assessment.risk_level ? <RiskHero level={assessment.risk_level} /> : <h1>{t("notScored")}</h1>}
      <ContextLine
        patient={assessment.patient_label}
        site={assessment.wound_site}
        day={assessment.days_post_op}
      />
      <p className="lede">{assessment.summary}</p>
      <p className="muted">{t("showBand")}</p>
      <Actions>
        <button className="btn primary" type="button" onClick={onNext}>
          {t("nextProb")}
        </button>
      </Actions>
      </div>
    </div>
  );
}

export function ConfidenceScreen({
  assessment,
  onBack,
  onNext,
}: {
  assessment: Assessment;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="split">
      <div className="frame">
        <img src={assessment.image_url} alt="Wound photograph" />
      </div>
      <div className="card">
      <h1>{t("howSure")}</h1>
      <Meter
        label={t("probability")}
        value={assessment.probability ?? 0}
        hint="How concerning this photograph looks."
      />
      <Meter
        label={t("confidence")}
        value={assessment.confidence ?? 0}
        hint="How stable the score is, from how focused the color signal is."
      />
      {assessment.drivers.map((driver) => (
        <Meter key={driver.name} label={driver.name} value={driver.value} hint={driver.note} />
      ))}
      <Actions>
        <button className="btn primary" type="button" onClick={onNext}>
          Grad-CAM explanation
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
      </div>
    </div>
  );
}

export function ExplainScreen({
  assessment,
  onBack,
  onNext,
}: {
  assessment: Assessment;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t, lang } = useLang();
  const [blend, setBlend] = useState(0.75);
  const [explanation, setExplanation] = useState<Assessment["explanation"]>(null);
  const [waiting, setWaiting] = useState(false);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const stored = assessment.explanation;
    const storedLang = stored?.language ?? "en";
    const ready = (stored && storedLang === lang ? stored : null) ?? explainCache.get(`${assessment.id}:${lang}`) ?? null;
    if (ready) {
      setExplanation(ready);
      setWaiting(false);
      return;
    }
    if (assessment.sample) return;
    let alive = true;
    setExplanation(null);
    setWaiting(true);
    startExplain(assessment.id, lang)
      .then((updated) => {
        const next = updated.explanation ?? explainCache.get(`${assessment.id}:${lang}`) ?? null;
        if (alive) {
          setExplanation(next);
          setWaiting(false);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setEngineNote(error instanceof Error ? error.message : "The explanation engine did not respond.");
          setWaiting(false);
        }
      });
    const timer = window.setInterval(() => {
      const cached = explainCache.get(`${assessment.id}:${lang}`);
      if (!cached) return;
      setExplanation(cached);
      setWaiting(false);
    }, 400);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [assessment.id, assessment.sample, assessment.explanation, lang]);

  return (
    <>
    <div className="split">
      <div className="frame">
        <img src={assessment.image_url} alt="Wound photograph" />
        {assessment.heatmap_url ? (
          <img className="heat" src={assessment.heatmap_url} alt="" style={{ opacity: blend }} />
        ) : null}
        {assessment.sample ? <span className="sample">Sample photo</span> : null}
      </div>
      <div className="card">
      <h1>{t("highlighted")}</h1>
      <label className="field">
        Map strength
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={blend}
          onChange={(event) => setBlend(Number(event.target.value))}
        />
      </label>
      <div className="legend">
        <span>{t("less")}</span>
        <i />
        <span>{t("moreInfluence")}</span>
      </div>
      <p className="muted">{t("warmer")}</p>
      <ElasticSlider
        defaultValue={75}
        startingValue={0}
        maxValue={100}
        leftIcon={<span>Less</span>}
        rightIcon={<span>More</span>}
        onChange={(value: number) => setBlend(value / 100)}
      />
      <Actions>
        <button className="btn primary" type="button" onClick={onNext}>
          {t("saveAssessment")}
        </button>
        <button className="btn" type="button" onClick={onBack}>
          {t("back")}
        </button>
      </Actions>
      </div>
    </div>
    <section className="clinical-note">
      <h2>{t("qwenTitle")}</h2>
      {explanation ? (
        <div className="actions">
          <button
            className="btn"
            type="button"
            onClick={() => {
              const text = [
                `What the model saw. ${explanation.what_the_model_saw}`,
                `Risk explanation. ${explanation.risk_explanation}`,
                `Next-step guidance. ${explanation.next_step_guidance}`,
                `Warning signs. ${explanation.warning_signs}`,
                "This does not confirm an infection.",
              ].join(" ");
              window.speechSynthesis.cancel();
              setPaused(false);
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = speechLang(lang);
              window.speechSynthesis.speak(utterance);
            }}
          >
            {t("read")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                setPaused(false);
              } else {
                window.speechSynthesis.pause();
                setPaused(true);
              }
            }}
          >
            {paused ? t("resume") : t("pause")}
          </button>
        </div>
      ) : null}
      {assessment.sample ? <p>Sample photographs skip the language model.</p> : null}
      {waiting ? (
        <ThoughtLine label="Qwen2.5-VL is reading the photograph and the wound, symptom, and surgery details." working />
      ) : null}
      {engineNote ? <p className="alert">{engineNote}</p> : null}
      {explanation ? (
        <>
          <h2>{t("whatSaw")}</h2>
          <p>{explanation.what_the_model_saw}</p>
          <h2>{t("riskExplain")}</h2>
          <p>{explanation.risk_explanation}</p>
          <h2>{t("nextStep")}</h2>
          <p>{explanation.next_step_guidance}</p>
          <h2>{t("warningSigns")}</h2>
          <p>{explanation.warning_signs}</p>
        </>
      ) : null}
    </section>
    </>
  );
}

export function SaveScreen({
  assessment,
  busy,
  onSave,
  onCompare,
  onBack,
}: {
  assessment: Assessment;
  busy: boolean;
  onSave: () => void;
  onCompare: () => void;
  onBack: () => void;
}) {
  return (
    <div className="split">
      <div className="frame">
        <img src={assessment.overlay_url ?? assessment.image_url} alt="Saved wound assessment" />
      </div>
      <div className="card">
      <h1>{assessment.saved ? "Assessment saved." : "Keep this result."}</h1>
      <p className="context">
        <span className={`pill ${riskClass(assessment.risk_level)}`}>{assessment.risk_level}</span>
        {" · "}
        {pct(assessment.probability)} concern · {pct(assessment.confidence)} confidence
      </p>
      <p className="lede">{assessment.summary}</p>
      <Actions>
        {assessment.saved ? (
          <button className="btn primary" type="button" onClick={onCompare}>
            Compare previous assessment
          </button>
        ) : (
          <button className="btn primary" type="button" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save assessment"}
          </button>
        )}
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
      </div>
    </div>
  );
}
