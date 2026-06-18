import Anthropic from "@anthropic-ai/sdk";

export const ORIGINAL_LENGTH_TOLERANCE = 20;
export const LENGTH_VALIDATION_WORD_LIMIT = 1000;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const REWRITE_MAX_TOKENS = Number(process.env.REWRITE_MAX_TOKENS ?? "8192");
const SCRIPT_MAX_ATTEMPTS = Number(process.env.SCRIPT_MAX_ATTEMPTS ?? "3");

export function countWords(text: string): number {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

export function stripJsonFences(text: string): string {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    const firstNewline = raw.indexOf("\n");
    raw = firstNewline !== -1 ? raw.slice(firstNewline + 1) : raw;
    if (raw.trimStart().startsWith("json")) {
      const jsonNewline = raw.indexOf("\n");
      raw = jsonNewline !== -1 ? raw.slice(jsonNewline + 1) : raw;
    }
  }
  if (raw.trimEnd().endsWith("```")) {
    const fence = raw.lastIndexOf("```");
    raw = fence !== -1 ? raw.slice(0, fence) : raw;
  }
  return raw.trim();
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const raw = stripJsonFences(text);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end)) as Record<string, unknown>;
    }
    throw new Error("Failed to parse JSON from Claude response.");
  }
}

export function shouldEnforceLengthValidation(originalWordCount: number): boolean {
  return originalWordCount <= LENGTH_VALIDATION_WORD_LIMIT;
}

export function validateFullScript(
  fullScript: string,
  originalWordCount: number,
  tolerance: number = ORIGINAL_LENGTH_TOLERANCE
): string[] {
  const issues: string[] = [];
  const text = (fullScript || "").trim();
  if (!text) {
    return ["full_script is missing or empty"];
  }

  if (!shouldEnforceLengthValidation(originalWordCount)) {
    return issues;
  }

  const totalWords = countWords(text);
  const totalMin = Math.max(1, originalWordCount - tolerance);
  const totalMax = originalWordCount + tolerance;

  if (totalWords < totalMin) {
    issues.push(
      `full script has ${totalWords} words — must stay within ${originalWordCount} ±${tolerance} (min ${totalMin})`
    );
  }
  if (totalWords > totalMax) {
    issues.push(
      `full script has ${totalWords} words — must stay within ${originalWordCount} ±${tolerance} (max ${totalMax})`
    );
  }
  return issues;
}

export function buildScriptRetryFeedback(
  issues: string[],
  fullScript: string,
  originalWordCount: number,
  tolerance: number = ORIGINAL_LENGTH_TOLERANCE
): string {
  const wc = countWords(fullScript);
  const target = originalWordCount;
  const minW = Math.max(1, originalWordCount - tolerance);
  const maxW = originalWordCount + tolerance;

  let action: string;
  if (wc > maxW) {
    action = `TOO LONG by ${wc - maxW} words. Hard ceiling is ${maxW} words — you MUST delete at least ${wc - maxW} words. Tighten sentences, cut redundant lines, do not add anything new.`;
  } else if (wc < minW) {
    action = `TOO SHORT by ${minW - wc} words. Add at least ${minW - wc} words without changing structure.`;
  } else {
    action = `Aim for exactly ${target} words (allowed range ${minW}–${maxW}).`;
  }

  let preview = fullScript;
  if (preview.length > 4000) {
    preview = preview.slice(0, 4000) + "\n… (truncated)";
  }

  return (
    "Your previous full_script FAILED the word-count check:\n- " +
    issues.join("\n- ") +
    `\n\nYou returned ${wc} words. Required range: ${minW}–${maxW} ` +
    `(ideal ${target}, ±${tolerance}).\n${action}\n\n` +
    "Edit the script below — same message and tone, but hit the word budget. " +
    "Replace existing benefits only — do not add new ones from the brand profile.\n\n" +
    "YOUR PREVIOUS SCRIPT:\n" +
    preview
  );
}

export function trimScriptToMaxWords(fullScript: string, maxWords: number): string {
  const words = fullScript.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return fullScript;
  }

  for (let cut = maxWords; cut >= Math.max(maxWords - 30, 1); cut--) {
    if (cut <= 0) break;
    const lastWord = words[cut - 1] ?? "";
    if (
      lastWord.endsWith(".") ||
      lastWord.endsWith("!") ||
      lastWord.endsWith("?") ||
      lastWord.endsWith("…") ||
      (cut < words.length && lastWord.endsWith(","))
    ) {
      return words.slice(0, cut).join(" ");
    }
  }

  return words.slice(0, maxWords).join(" ");
}

export function scriptRewritePrompt(params: {
  transcript: string;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  originalWordCount: number;
  totalWordTarget: number;
  totalWordMin: number;
  totalWordMax: number;
  enforceLengthValidation: boolean;
  retryFeedback?: string;
}): string {
  const tol = ORIGINAL_LENGTH_TOLERANCE;
  const retryBlock = params.retryFeedback
    ? `\n== FIX REQUEST ==\n${params.retryFeedback}\n`
    : "";

  const lengthBlock = params.enforceLengthValidation
    ? `WORD BUDGET (hard limit — validated):
- Original: ${params.originalWordCount} words → yours MUST be ${params.totalWordMin}–${params.totalWordMax} (ideal ${params.totalWordTarget}, ±${tol})
- NEVER exceed ${params.totalWordMax}. When in doubt, write shorter.
- Add a phrase only if you remove one elsewhere. Net length stays flat.`
    : `LENGTH (long-form — no strict word-count validation):
- Original: ${params.originalWordCount} words. Preserve overall structure, pacing, and approximate length.
- Do not aggressively pad or cut. Mirror the original's scope and depth.`;

  return `You are an elite direct-response ad copywriter who specialises in short-form video ads.

GOAL — TIGHT BRAND SWAP:
Mirror the original ad's structure, hooks, and pacing. Do not rewrite from scratch or pad
with extra copy.

BENEFITS — replace in place, never pile on:
The original ad already mentions benefits. For each one, either (a) swap it for a relevant
benefit from the brand profile below, or (b) leave it as-is if it's close enough to your product.
Do NOT add benefits that weren't in the original. Do NOT try to fit every benefit listed in
the brand profile — you are replacing what the original already said, not expanding the list.

${lengthBlock}

== ORIGINAL TRANSCRIPT (${params.originalWordCount} words) ==
${params.transcript}

== NEW BRAND ==
Name: ${params.brandName}
Product: ${params.productDescription}
Target audience: ${params.targetAudience}
Tone/voice: ${params.tone}
${retryBlock}
== OUTPUT (strict JSON, no markdown fences) ==
{
  "full_script": "the complete rewritten script as one continuous piece of spoken copy",
  "word_count": ${params.totalWordTarget}
}

Set word_count to the exact number of words in full_script. Return ONLY the JSON object.`;
}

async function callClaudeJson(
  client: Anthropic,
  prompt: string,
  maxTokens: number
): Promise<Record<string, unknown>> {
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  if (msg.stop_reason === "max_tokens") {
    throw new Error("Claude response was cut off — please retry.");
  }

  const textBlock = msg.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content.");
  }

  return parseJsonObject(textBlock.text);
}

export type RewriteScriptInput = {
  transcript: string;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  client?: Anthropic;
};

export type RewriteScriptResult = {
  full_script: string;
  word_count: number;
  script_attempts: number;
  script_trimmed: boolean;
  meta: {
    original_word_count: number;
    total_word_target: number;
    total_word_min: number;
    total_word_max: number;
    length_validation_enforced: boolean;
  };
};

export type RewriteScriptError = {
  message: string;
  phase: "script";
  issues: string[];
  attempts: number;
  word_count: number;
};

export async function rewriteScript(
  input: RewriteScriptInput
): Promise<RewriteScriptResult> {
  const client =
    input.client ??
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const originalWordCount = countWords(input.transcript);
  const enforceLengthValidation = shouldEnforceLengthValidation(originalWordCount);
  const plan = {
    original_word_count: originalWordCount,
    total_word_target: originalWordCount,
    total_word_min: Math.max(1, originalWordCount - ORIGINAL_LENGTH_TOLERANCE),
    total_word_max: originalWordCount + ORIGINAL_LENGTH_TOLERANCE,
    length_validation_enforced: enforceLengthValidation,
  };

  let fullScript = "";
  let scriptIssues: string[] = [];
  let scriptAttempts = 0;
  let scriptTrimmed = false;

  for (let attempt = 0; attempt < SCRIPT_MAX_ATTEMPTS; attempt++) {
    const feedback =
      enforceLengthValidation && attempt > 0 && scriptIssues.length > 0
        ? buildScriptRetryFeedback(scriptIssues, fullScript, originalWordCount)
        : "";

    const result = await callClaudeJson(
      client,
      scriptRewritePrompt({
        transcript: input.transcript,
        brandName: input.brandName,
        productDescription: input.productDescription,
        targetAudience: input.targetAudience,
        tone: input.tone,
        originalWordCount,
        totalWordTarget: plan.total_word_target,
        totalWordMin: plan.total_word_min,
        totalWordMax: plan.total_word_max,
        enforceLengthValidation,
        retryFeedback: feedback,
      }),
      REWRITE_MAX_TOKENS
    );

    scriptAttempts = attempt + 1;
    fullScript = String(result.full_script ?? "").trim();
    scriptIssues = validateFullScript(fullScript, originalWordCount);
    if (scriptIssues.length === 0) {
      break;
    }
  }

  if (
    enforceLengthValidation &&
    scriptIssues.length > 0 &&
    countWords(fullScript) > plan.total_word_max
  ) {
    fullScript = trimScriptToMaxWords(fullScript, plan.total_word_max);
    scriptIssues = validateFullScript(fullScript, originalWordCount);
    if (scriptIssues.length === 0) {
      scriptTrimmed = true;
    }
  }

  if (scriptIssues.length > 0) {
    const err: RewriteScriptError = {
      message: "Script rewrite failed length validation after retry.",
      phase: "script",
      issues: scriptIssues,
      attempts: scriptAttempts,
      word_count: countWords(fullScript),
    };
    throw err;
  }

  return {
    full_script: fullScript,
    word_count: countWords(fullScript),
    script_attempts: scriptAttempts,
    script_trimmed: scriptTrimmed,
    meta: plan,
  };
}
