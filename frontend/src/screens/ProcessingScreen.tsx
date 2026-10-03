import { useEffect, useState } from "react";
import VoicePill from "@/components/VoicePill";
import { runAssessment } from "../api";
import type { Assessment } from "../types";

const STAGES = [
  "EfficientNet is scoring infection-associated risk",
  "Building the Grad-CAM map",
  "Packing wound, symptom, and surgery details",
];

export function ProcessingScreen({
  assessmentId,
  onDone,
  onError,
}: {
  assessmentId: string;
  onDone: (assessment: Assessment) => void;
  onError: (message: string) => void;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let cancel = false;
    const timers = [1, 2].map((step) => window.setTimeout(() => setStage(step), step * 550));
    const started = Date.now();
    runAssessment(assessmentId)
      .then(async (result) => {
        const wait = 1700 - (Date.now() - started);
        if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
        if (!cancel) onDone(result);
      })
      .catch((error: unknown) => {
        if (!cancel) onError(error instanceof Error ? error.message : "Scoring failed.");
      });
    return () => {
      cancel = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [assessmentId, onDone, onError]);

  return (
    <>
      <h1>Reading the photograph.</h1>
      <VoicePill />
      <div className="stages">
        {STAGES.map((label, index) => (
          <div key={label} className={index < stage ? "stage done" : index === stage ? "stage on" : "stage"}>
            <b>{label}</b>
            <span>{index < stage ? "Done" : index === stage ? "Working" : "Waiting"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
