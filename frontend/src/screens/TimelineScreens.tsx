import { useEffect, useState } from "react";
import { compareAssessments, listAssessments, loadTrend } from "../api";
import { Actions } from "../components";
import { formatWhen, pct, riskClass } from "../format";
import { RiskChart } from "../RiskChart";
import type { Assessment, CompareResult, Trend } from "../types";

export function CompareScreen({
  assessment,
  onTrend,
  onBack,
}: {
  assessment: Assessment;
  onTrend: () => void;
  onBack: () => void;
}) {
  const [options, setOptions] = useState<Assessment[]>([]);
  const [previousId, setPreviousId] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listAssessments(assessment.patient_label)
      .then((rows) => {
        if (cancel) return;
        const earlier = rows.filter(
          (row) => row.id !== assessment.id && row.saved && row.created_at < assessment.created_at && row.risk_level,
        );
        setOptions(earlier);
        setPreviousId(earlier[0]?.id ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancel) {
          setLocalError("Could not load earlier assessments.");
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [assessment.id, assessment.patient_label, assessment.created_at]);

  useEffect(() => {
    if (!previousId) return;
    let cancel = false;
    compareAssessments(assessment.id, previousId)
      .then((data) => {
        if (!cancel) setResult(data);
      })
      .catch(() => {
        if (!cancel) setLocalError("Could not compare those photographs.");
      });
    return () => {
      cancel = true;
    };
  }, [assessment.id, previousId]);

  const points = result ? result.delta_probability * 100 : 0;
  const change =
    result?.direction === "worsening"
      ? {
          headline: "Risk increased",
          arrow: `↑ +${Math.abs(points).toFixed(1)} pp`,
          note: "The model assigned a higher infection-associated risk to the current image than the previous assessment.",
        }
      : result?.direction === "improving"
        ? {
            headline: "Risk decreased",
            arrow: `↓ −${Math.abs(points).toFixed(1)} pp`,
            note: "The model assigned a lower infection-associated risk to the current image than the previous assessment.",
          }
        : {
            headline: "Risk unchanged",
            arrow: `${points >= 0 ? "+" : "−"}${Math.abs(points).toFixed(1)} pp`,
            note: "The model assigned a similar infection-associated risk to the current image and the previous assessment.",
          };

  return (
    <>
      <h1>Against the last photo.</h1>
      {loading ? <p className="muted">Looking up earlier assessments.</p> : null}
      {localError ? <p className="alert">{localError}</p> : null}
      {!loading && options.length === 0 ? (
        <p className="lede">Save at least two assessments for this patient to compare them.</p>
      ) : null}
      {options.length > 0 ? (
        <label className="field">
          Previous assessment
          <select value={previousId} onChange={(event) => setPreviousId(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {formatWhen(option.created_at)} · {option.risk_level}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {result ? (
        <>
          <div className={`change-board ${result.direction}`}>
            <div>
              <span className="kicker">Previous</span>
              <strong>{pct(result.previous.probability)}</strong>
              <span className={`pill ${riskClass(result.previous.risk_level)}`}>{result.previous.risk_level}</span>
            </div>
            <div>
              <span className="kicker">Current</span>
              <strong>{pct(result.current.probability)}</strong>
              <span className={`pill ${riskClass(result.current.risk_level)}`}>{result.current.risk_level}</span>
            </div>
            <p className="change-arrow">{change.arrow}</p>
            <p className="change-headline">{change.headline}</p>
          </div>
          <div className="compare">
            <figure>
              <div className="frame">
                <img src={result.previous.image_url} alt="Earlier wound photograph" />
              </div>
              <figcaption>Previous</figcaption>
            </figure>
            <figure>
              <div className="frame">
                <img src={result.current.image_url} alt="Current wound photograph" />
              </div>
              <figcaption>Current</figcaption>
            </figure>
          </div>
          <section className="clinical-note">
            <h2>Clinical note</h2>
            <p>
              <strong>AI screening change:</strong> {change.note}
            </p>
            <p>
              <strong>Important:</strong> Changes in AI risk do not establish that an infection has developed. Clinical
              evaluation should be used to determine the cause of wound changes.
            </p>
          </section>
        </>
      ) : null}
      <Actions>
        <button className="btn primary" type="button" onClick={onTrend}>
          Risk trend
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
    </>
  );
}

export function TrendScreen({
  assessment,
  onReport,
  onBack,
  onOpenPoint,
}: {
  assessment: Assessment;
  onReport: () => void;
  onBack: () => void;
  onOpenPoint?: (id: string) => void;
}) {
  const [trend, setTrend] = useState<Trend | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadTrend(assessment.patient_label)
      .then((data) => {
        if (!cancel) setTrend(data);
      })
      .catch(() => {
        if (!cancel) setLocalError("Could not load the trend.");
      });
    return () => {
      cancel = true;
    };
  }, [assessment.patient_label]);

  const points = trend?.points ?? [];
  const latest = points[points.length - 1];

  return (
    <>
      <h1>Concern over time.</h1>
      <p className="context">{assessment.patient_label}</p>
      {localError ? <p className="alert">{localError}</p> : null}
      {latest ? (
        <p className="lede">
          Latest band is {latest.risk_level} at {pct(latest.probability)}.
        </p>
      ) : (
        <p className="muted">Save an assessment to start the chart.</p>
      )}
      {points.length > 0 ? (
        <RiskChart points={points} tall onPoint={onOpenPoint} />
      ) : null}
      <Actions>
        <button className="btn primary" type="button" onClick={onReport}>
          Generate report
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
    </>
  );
}

export function ReportScreen({
  assessment,
  onHome,
  onBack,
  onSaved,
}: {
  assessment: Assessment;
  onHome: () => void;
  onBack: () => void;
  onSaved?: () => void;
}) {
  const href = `/api/assessments/${assessment.id}/report`;
  return (
    <>
      <iframe className="report-frame" title="Assessment report" src={href} />
      <Actions>
        <a className="btn primary" href={href} target="_blank" rel="noreferrer" onClick={() => onSaved?.()}>
          Open report
        </a>
        <button className="btn" type="button" onClick={onHome}>
          Done
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
    </>
  );
}
