import { Actions } from "../components";
import type { Assessment } from "../types";

export function QualityScreen({
  assessment,
  checking,
  onContinue,
  onRetake,
}: {
  assessment: Assessment | null;
  checking: boolean;
  onContinue: () => void;
  onRetake: () => void;
}) {
  if (checking || !assessment) {
    return (
      <>
        <h1>Checking the photograph.</h1>
        <p className="lede">Looking at frame size, focus, light, and surface detail.</p>
      </>
    );
  }

  const failed = assessment.quality.checks.filter((check) => !check.passed);
  return (
    <div className="split">
      <div className="frame">
        <img src={assessment.image_url} alt="Uploaded wound photograph" />
      </div>
      <div className="card">
      <h1>{assessment.quality.passed ? "Photo accepted." : "Retake this photo."}</h1>
      <div className="checks">
        {assessment.quality.checks.map((check) => (
          <div key={check.id} className={check.passed ? "check" : "check bad"}>
            <span>
              <b>{check.label}</b>
              <span>{check.passed ? check.detail : check.advice}</span>
            </span>
            <b>{check.passed ? "Pass" : "Redo"}</b>
          </div>
        ))}
      </div>
      {failed.length > 0 ? (
        <p className="muted">Scoring stays off until every check passes.</p>
      ) : (
        <p className="muted">The photograph is clear enough to score.</p>
      )}
      <Actions>
        {assessment.quality.passed ? (
          <button className="btn primary" type="button" onClick={onContinue}>
            Continue to AI processing
          </button>
        ) : null}
        <button className="btn" type="button" onClick={onRetake}>
          Retake photo
        </button>
      </Actions>
      </div>
    </div>
  );
}
