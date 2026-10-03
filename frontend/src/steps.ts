export const STEPS = [
  { id: "home", n: 1, title: "Open PostOp AI" },
  { id: "capture", n: 2, title: "Capture wound photo" },
  { id: "upload", n: 3, title: "Upload" },
  { id: "quality", n: 4, title: "Image quality check" },
  { id: "processing", n: 5, title: "AI processing" },
  { id: "risk", n: 6, title: "Risk band" },
  { id: "confidence", n: 7, title: "Probability and confidence" },
  { id: "explain", n: 8, title: "Explanation engine" },
  { id: "save", n: 9, title: "Save assessment" },
  { id: "compare", n: 10, title: "Compare previous assessment" },
  { id: "trend", n: 11, title: "Risk trend" },
  { id: "report", n: 12, title: "Assessment report" },
] as const;

export type ScreenId = (typeof STEPS)[number]["id"];
