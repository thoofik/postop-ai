import { Actions } from "../components";

export function UploadScreen({
  previewUrl,
  busy,
  onUpload,
  onRetake,
}: {
  previewUrl: string;
  busy: boolean;
  onUpload: () => void;
  onRetake: () => void;
}) {
  return (
    <div className="split">
      <div className="frame">
        <img src={previewUrl} alt="Wound photograph ready to upload" />
      </div>
      <div className="card">
      <h1>Ready to upload</h1>
      <p className="lede">Check the frame, then upload it for the quality check.</p>
      <Actions>
        <button className="btn primary" type="button" disabled={busy} onClick={onUpload}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={onRetake}>
          Retake
        </button>
      </Actions>
      </div>
    </div>
  );
}
