import { useCallback, useEffect, useState } from "react";
import SwipeToast from "@/components/SwipeToast";
import { checkQuality, listAssessments, saveAssessment, seedDemo } from "./api";
import { MobileNav, WizardBar, navForScreen, type NavId } from "./components";
import { CaptureScreen } from "./screens/CaptureScreen";
import {
  Activity,
  CircleHelp,
  ClipboardPlus,
  FileText,
  History,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { FloatingDock } from "@/components/ui/floating-dock";
import { LANGS, useLang } from "./i18n";
import { DetailsScreen, HistoryScreen, HomeScreen, InfoScreen } from "./screens/HomeScreen";
import { ProcessingScreen } from "./screens/ProcessingScreen";
import { QualityScreen } from "./screens/QualityScreen";
import { ConfidenceScreen, ExplainScreen, RiskScreen, SaveScreen } from "./screens/ResultScreens";
import { CompareScreen, ReportScreen, TrendScreen } from "./screens/TimelineScreens";
import { UploadScreen } from "./screens/UploadScreen";
import type { ScreenId } from "./steps";
import type { Assessment, Profile } from "./types";

type View = ScreenId | "history" | "settings" | "help" | "details";

type Photo = { blob: Blob; url: string };

export function App() {
  const { t, lang, setLang } = useLang();
  const [screen, setScreen] = useState<View>("home");
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({
    patient_label: "My recovery",
    wound_site: "Incision",
    days_post_op: "3",
    procedure: "",
    symptoms: [],
  });
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!photo) return;
    const url = photo.url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const refreshHistory = useCallback(() => {
    listAssessments()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (screen === "home" || screen === "history" || screen === "trend") refreshHistory();
  }, [screen, refreshHistory]);

  function go(next: View) {
    setError(null);
    setScreen(next);
  }

  function navigate(id: NavId) {
    if (id === "dashboard") go("home");
    else if (id === "assess") go("details");
    else if (id === "history") go("history");
    else if (id === "settings") go("settings");
    else if (id === "help") go("help");
    else if (id === "trend") {
      const latest = history.find((item) => item.saved && item.risk_level);
      if (latest) setAssessment(latest);
      go("trend");
    } else if (id === "insights") {
      const latest = history.find((item) => item.saved && item.risk_level);
      if (latest) setAssessment(latest);
      go("compare");
    } else if (id === "reports") {
      const latest = history.find((item) => item.saved && item.risk_level);
      if (latest) setAssessment(latest);
      go("report");
    }
  }

  function rememberPhoto(blob: Blob) {
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    setAssessment(null);
    go("upload");
  }

  async function upload() {
    if (!photo) return;
    setChecking(true);
    setError(null);
    setAssessment(null);
    setScreen("quality");
    try {
      const draft = await checkQuality(photo.blob, profile);
      setAssessment(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setScreen("upload");
    } finally {
      setChecking(false);
    }
  }

  const onProcessed = useCallback((result: Assessment) => {
    setAssessment(result);
    setError(null);
    setScreen("risk");
  }, []);

  const onProcessError = useCallback((message: string) => {
    setError(message);
    setScreen("quality");
  }, []);

  async function save() {
    if (!assessment) return;
    setBusy(true);
    try {
      setAssessment(await saveAssessment(assessment.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    setNotice(null);
    try {
      await seedDemo();
      setHistory(await listAssessments());
      setNotice("Sample timeline ready for Demo patient. Open the newest row to walk the result.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the sample timeline.");
    } finally {
      setBusy(false);
    }
  }

  let body = null;
  if (screen === "home") {
    body = (
      <HomeScreen
        history={history}
        onStart={() => go("details")}
        onOpen={(item) => {
          setAssessment(item);
          go(item.risk_level ? "risk" : "quality");
        }}
        onTrend={() => navigate("trend")}
        onNavigate={navigate}
      />
    );
  } else if (screen === "details") {
    body = (
      <DetailsScreen
        onBack={() => go("home")}
        onContinue={(next) => {
          setProfile(next);
          setPhoto(null);
          setAssessment(null);
          go("capture");
        }}
      />
    );
  } else if (screen === "history") {
    body = (
      <HistoryScreen
        history={history}
        notice={notice}
        busy={busy}
        onOpen={(item) => {
          setAssessment(item);
          go(item.risk_level ? "risk" : "quality");
        }}
        onSeed={() => void seed()}
        onStart={() => go("details")}
      />
    );
  } else if (screen === "settings") {
    body = (
      <InfoScreen
        title="Settings"
        body="Scoring runs on this computer. EfficientNet assigns the risk band. Qwen writes the explanation on the graphics card when that step is opened. No API key is stored in the browser."
      />
    );
  } else if (screen === "help") {
    body = (
      <div className="help-page">
        <h1>{t("help")}</h1>
        <p className="lede">{t("helpLead")}</p>
        <div className="portal-grid">
          <div>
            <div>
              <b>{t("helpPhoto")}</b>
              <span>{t("helpPhotoBody")}</span>
            </div>
            <div>
              <b>{t("helpScore")}</b>
              <span>{t("helpScoreBody")}</span>
            </div>
            <div>
              <b>{t("helpExplain")}</b>
              <span>{t("helpExplainBody")}</span>
            </div>
            <div>
              <b>{t("cardLimit")}</b>
              <span>{t("helpLimitBody")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (screen === "capture") {
    body = <CaptureScreen onBack={() => go("home")} onShot={rememberPhoto} />;
  } else if (screen === "upload" && photo) {
    body = (
      <UploadScreen
        previewUrl={photo.url}
        busy={checking}
        onUpload={() => void upload()}
        onRetake={() => go("capture")}
      />
    );
  } else if (screen === "quality") {
    body = (
      <QualityScreen
        assessment={assessment}
        checking={checking}
        onContinue={() => go("processing")}
        onRetake={() => go("capture")}
      />
    );
  } else if (screen === "processing" && assessment) {
    body = <ProcessingScreen assessmentId={assessment.id} onDone={onProcessed} onError={onProcessError} />;
  } else if (screen === "risk" && assessment) {
    body = <RiskScreen assessment={assessment} onNext={() => go("confidence")} />;
  } else if (screen === "confidence" && assessment) {
    body = (
      <ConfidenceScreen
        assessment={assessment}
        onBack={() => go("risk")}
        onNext={() => go("explain")}
      />
    );
  } else if (screen === "explain" && assessment) {
    body = <ExplainScreen assessment={assessment} onBack={() => go("confidence")} onNext={() => go("save")} />;
  } else if (screen === "save" && assessment) {
    body = (
      <SaveScreen
        assessment={assessment}
        busy={busy}
        onSave={() => void save()}
        onCompare={() => go("compare")}
        onBack={() => go("explain")}
      />
    );
  } else if (screen === "compare" && !assessment) {
    body = <InfoScreen title="AI insights" body="Open a saved assessment to compare it with an earlier photograph." />;
  } else if (screen === "compare" && assessment) {
    body = <CompareScreen assessment={assessment} onTrend={() => go("trend")} onBack={() => go("save")} />;
  } else if (screen === "trend" && !assessment) {
    body = (
      <InfoScreen
        title="Recovery trend"
        body="Save an assessment first. The chart uses the dates of saved scores, not a repeated postoperative day."
      />
    );
  } else if (screen === "trend" && assessment) {
    body = (
      <TrendScreen
        assessment={assessment}
        onReport={() => go("report")}
        onBack={() => go("home")}
        onOpenPoint={(id) => {
          const item = history.find((row) => row.id === id);
          if (!item) return;
          setAssessment(item);
          go("risk");
        }}
      />
    );
  } else if (screen === "report" && !assessment) {
    body = <InfoScreen title="Reports" body="Save an assessment, then open its report from the result steps." />;
  } else if (screen === "report" && assessment) {
    body = (
      <ReportScreen
        assessment={assessment}
        onHome={() => go("home")}
        onBack={() => go("trend")}
        onSaved={() => {
          setToast("Report opened. Use the browser print dialog if you want a PDF.");
          window.setTimeout(() => setToast(null), 3200);
        }}
      />
    );
  } else {
    body = (
      <button className="btn primary" type="button" onClick={() => go("home")}>
        Back to start
      </button>
    );
  }

  return (
    <div className="app">
      <FloatingDock
        desktopClassName="fixed bottom-5 left-1/2 z-40 -translate-x-1/2"
        items={[
          { title: t("dashboard"), icon: <LayoutDashboard size={18} />, href: "#dashboard", onClick: () => navigate("dashboard") },
          { title: t("assess"), icon: <ClipboardPlus size={18} />, href: "#assess", onClick: () => navigate("assess") },
          { title: t("assessments"), icon: <History size={18} />, href: "#history", onClick: () => navigate("history") },
          { title: t("trend"), icon: <Activity size={18} />, href: "#trend", onClick: () => navigate("trend") },
          { title: t("insights"), icon: <Sparkles size={18} />, href: "#insights", onClick: () => navigate("insights") },
          { title: t("reports"), icon: <FileText size={18} />, href: "#reports", onClick: () => navigate("reports") },
          { title: t("help"), icon: <CircleHelp size={18} />, href: "#help", onClick: () => navigate("help") },
        ]}
      />
      <label className="lang-pick">
        <select value={lang} aria-label="Language" onChange={(event) => setLang(event.target.value as typeof lang)}>
          {LANGS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="workspace">
        <main className="screen">
          <WizardBar screen={screen} />
          {toast ? (
            <div className="fixed bottom-6 right-6 z-50">
              <SwipeToast title="Report" description={toast} open onClose={() => setToast(null)} />
            </div>
          ) : null}
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {body}
        </main>
      </div>
      <MobileNav current={navForScreen(screen)} onNavigate={navigate} />
      {screen === "home" || screen === "history" ? (
        <button className="fab" type="button" onClick={() => go("details")}>
          + New assessment
        </button>
      ) : null}
    </div>
  );
}
