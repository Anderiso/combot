import type { FunnelStage } from "@/lib/database.types";
import { normalizeFunnelStage } from "@/lib/funnel";

export type LoadAiRecommendation = {
  funnel_stage: FunnelStage;
  explanation: string;
};

export type LoadSession = {
  transcript: string;
  transcribeNote: string | null;
  title: string;
  description: string;
  funnelStage: FunnelStage;
  aiRecommendation: LoadAiRecommendation | null;
  fileName: string | null;
};

const STORAGE_KEY = "combot-load-session";

const EMPTY_SESSION: LoadSession = {
  transcript: "",
  transcribeNote: null,
  title: "",
  description: "",
  funnelStage: "TMOF",
  aiRecommendation: null,
  fileName: null,
};

export function loadLoadSession(): LoadSession {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_SESSION;
    }

    const parsed = JSON.parse(raw) as Partial<LoadSession>;
    const funnelStage = normalizeFunnelStage(parsed.funnelStage);

    return {
      transcript: parsed.transcript ?? "",
      transcribeNote: parsed.transcribeNote ?? null,
      title: parsed.title ?? "",
      description: parsed.description ?? "",
      funnelStage,
      aiRecommendation: parsed.aiRecommendation ?? null,
      fileName: parsed.fileName ?? null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveLoadSession(session: LoadSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or private browsing — ignore.
  }
}

export function clearLoadSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
