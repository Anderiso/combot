export type RemixMeta = {
  original_word_count: number;
  total_word_target: number;
  total_word_min: number;
  total_word_max: number;
  length_validation_enforced?: boolean;
};

export type RemixSession = {
  transcript: string;
  remixedScript: string;
  tone: string;
  transcribeNote: string | null;
  remixMeta: RemixMeta | null;
  scriptAttempts: number | null;
  scriptTrimmed: boolean;
  fileName: string | null;
};

const STORAGE_KEY = "combot-remix-session";

const EMPTY_SESSION: RemixSession = {
  transcript: "",
  remixedScript: "",
  tone: "conversational, direct, short-form video ad",
  transcribeNote: null,
  remixMeta: null,
  scriptAttempts: null,
  scriptTrimmed: false,
  fileName: null,
};

export function loadRemixSession(): RemixSession {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_SESSION;
    }

    const parsed = JSON.parse(raw) as Partial<RemixSession>;
    return {
      transcript: parsed.transcript ?? "",
      remixedScript: parsed.remixedScript ?? "",
      tone: parsed.tone ?? EMPTY_SESSION.tone,
      transcribeNote: parsed.transcribeNote ?? null,
      remixMeta: parsed.remixMeta ?? null,
      scriptAttempts: parsed.scriptAttempts ?? null,
      scriptTrimmed: parsed.scriptTrimmed ?? false,
      fileName: parsed.fileName ?? null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveRemixSession(session: RemixSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or private browsing — ignore.
  }
}

export function clearRemixSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
