import { useEffect, useRef, useState } from "react";
import { Actions } from "../components";

export function CaptureScreen({
  onBack,
  onShot,
}: {
  onBack: () => void;
  onShot: (file: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const liveOk = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
  const [ready, setReady] = useState(false);
  const [camNote, setCamNote] = useState<string | null>(
    liveOk ? null : "Choose a photograph from this computer, or connect a camera.",
  );

  useEffect(() => {
    if (!liveOk) return;
    let stream: MediaStream | null = null;
    let cancel = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1600 } },
      })
      .then((next) => {
        stream = next;
        if (cancel) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = next;
      })
      .catch(() => {
        if (!cancel) setCamNote("Live camera is blocked. Use Open camera or the photo library.");
      });
    return () => {
      cancel = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [liveOk]);

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCamNote("Choose a JPEG, PNG, or WebP photograph.");
      return;
    }
    onShot(file);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onShot(blob);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="split">
      <div className="frame">
        {liveOk ? (
          <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} />
        ) : (
          <p className="lede" style={{ color: "white", padding: 18 }}>
            Choose a wound photograph from this computer.
          </p>
        )}
        {liveOk ? (
          <button className="shutter" type="button" disabled={!ready} onClick={shoot} aria-label="Shutter" />
        ) : null}
      </div>
      <div className="card">
      <h1>Capture the wound</h1>
      {camNote ? <p className="muted">{camNote}</p> : <p className="muted">The preview uses this computer’s camera.</p>}
      <input
        ref={cameraRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          takeFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          takeFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Actions>
        <button className="btn primary" type="button" onClick={() => cameraRef.current?.click()}>
          Open camera
        </button>
        <button className="btn" type="button" onClick={() => libraryRef.current?.click()}>
          Photo library
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </Actions>
      </div>
    </div>
  );
}
