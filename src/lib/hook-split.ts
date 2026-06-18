import Anthropic from "@anthropic-ai/sdk";
import {
  countWords,
  parseJsonObject,
} from "@/lib/script-rewrite";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const HOOK_SPLIT_MAX_TOKENS = Number(process.env.HOOK_SPLIT_MAX_TOKENS ?? "4096");
const HOOK_SPLIT_MAX_ATTEMPTS = Number(process.env.HOOK_SPLIT_MAX_ATTEMPTS ?? "3");
const HOOK_LENGTH_TOLERANCE = 5;

export type HookSplitResult = {
  hook1: string;
  hook2: string;
  hook3: string;
  body: string;
  hook_word_count: number;
  attempts: number;
};

export type HookSplitError = {
  message: string;
  phase: "hook_split";
  issues: string[];
  attempts: number;
};

function normalizeScript(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function scriptStartsWithHook(script: string, hook: string): boolean {
  const s = normalizeScript(script);
  const h = normalizeScript(hook);
  if (!h) return false;
  if (s.startsWith(h)) return true;
  return s.toLowerCase().startsWith(h.toLowerCase());
}

function deriveBody(script: string, hook: string): string {
  const s = normalizeScript(script);
  const h = normalizeScript(hook);
  if (s.startsWith(h)) {
    return s.slice(h.length).trim();
  }
  const lowerScript = s.toLowerCase();
  const lowerHook = h.toLowerCase();
  if (lowerScript.startsWith(lowerHook)) {
    return s.slice(h.length).trim();
  }
  return "";
}

function validateHookSplit(
  script: string,
  hook1: string,
  hook2: string,
  hook3: string,
  body: string
): string[] {
  const issues: string[] = [];
  const h1 = hook1.trim();
  const h2 = hook2.trim();
  const h3 = hook3.trim();
  const b = body.trim();

  if (!h1) issues.push("hook1 is missing or empty");
  if (!h2) issues.push("hook2 is missing or empty");
  if (!h3) issues.push("hook3 is missing or empty");
  if (!b) issues.push("body is missing or empty");

  if (h1 && !scriptStartsWithHook(script, h1)) {
    issues.push("hook1 must be the exact opening of the script");
  }

  if (h1 && b) {
    const derived = deriveBody(script, h1);
    if (!derived) {
      issues.push("body does not follow hook1 in the script");
    } else if (normalizeScript(derived) !== normalizeScript(b)) {
      issues.push("body must be everything after hook1 with no overlap");
    }
  }

  if (h1) {
    const target = countWords(h1);
    const minW = Math.max(3, target - HOOK_LENGTH_TOLERANCE);
    const maxW = target + HOOK_LENGTH_TOLERANCE;

    for (const [label, hook] of [
      ["hook2", h2],
      ["hook3", h3],
    ] as const) {
      const wc = countWords(hook);
      if (wc < minW || wc > maxW) {
        issues.push(
          `${label} has ${wc} words — must be ${minW}–${maxW} (hook1 is ${target} words)`
        );
      }
    }
  }

  if (h2 && h3 && normalizeScript(h2).toLowerCase() === normalizeScript(h3).toLowerCase()) {
    issues.push("hook2 and hook3 must be meaningfully different");
  }

  return issues;
}

function hookSplitPrompt(params: {
  script: string;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  retryFeedback?: string;
}): string {
  const retryBlock = params.retryFeedback
    ? `\n== FIX REQUEST ==\n${params.retryFeedback}\n`
    : "";

  return `You are an expert short-form video ad script editor.

TASK:
1. Identify the HOOK — the opening attention-grabbing section at the very start of the script.
   For spoken ads this is usually the first 1–3 sentences (roughly 8–25 words), but use your
   judgment based on pacing and intent. The hook ends where the main pitch/story begins.
2. Everything after the hook is the BODY.
3. Write hook2 and hook3 — alternate openings with the SAME approximate word count as hook1
   (within ±${HOOK_LENGTH_TOLERANCE} words). Same tone and product, different angle or phrasing.
   Do not repeat hook1 verbatim.

RULES:
- hook1 must be copied EXACTLY from the start of the script (character-for-character after trim).
- body must be the remainder of the script with zero overlap with hook1.
- hook2 and hook3 are rewrites only — body stays unchanged.

== SCRIPT ==
${params.script}

== BRAND CONTEXT ==
Name: ${params.brandName}
Product: ${params.productDescription}
Audience: ${params.targetAudience}
Tone: ${params.tone}
${retryBlock}
== OUTPUT (strict JSON, no markdown fences) ==
{
  "hook1": "exact opening hook from the script",
  "hook2": "alternate hook, similar length",
  "hook3": "second alternate hook, similar length",
  "body": "everything after hook1"
}

Return ONLY the JSON object.`;
}

function buildHookSplitRetryFeedback(
  issues: string[],
  payload: { hook1: string; hook2: string; hook3: string; body: string }
): string {
  return (
    "Your previous response FAILED validation:\n- " +
    issues.join("\n- ") +
    "\n\nFix the JSON. hook1 must match the script opening exactly.\n\n" +
    "YOUR PREVIOUS OUTPUT:\n" +
    JSON.stringify(payload, null, 2)
  );
}

async function callClaudeJson(
  client: Anthropic,
  prompt: string
): Promise<Record<string, unknown>> {
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: HOOK_SPLIT_MAX_TOKENS,
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

export type SplitHooksInput = {
  script: string;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  client?: Anthropic;
};

export async function splitHooks(input: SplitHooksInput): Promise<HookSplitResult> {
  const client =
    input.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const script = input.script.trim();
  if (!script) {
    throw new Error("script is required.");
  }

  let hook1 = "";
  let hook2 = "";
  let hook3 = "";
  let body = "";
  let issues: string[] = [];
  let attempts = 0;

  for (let attempt = 0; attempt < HOOK_SPLIT_MAX_ATTEMPTS; attempt++) {
    const feedback =
      attempt > 0 && issues.length > 0
        ? buildHookSplitRetryFeedback(issues, { hook1, hook2, hook3, body })
        : "";

    const result = await callClaudeJson(
      client,
      hookSplitPrompt({
        script,
        brandName: input.brandName,
        productDescription: input.productDescription,
        targetAudience: input.targetAudience,
        tone: input.tone,
        retryFeedback: feedback,
      })
    );

    attempts = attempt + 1;
    hook1 = String(result.hook1 ?? "").trim();
    hook2 = String(result.hook2 ?? "").trim();
    hook3 = String(result.hook3 ?? "").trim();
    body = String(result.body ?? "").trim();

    if (!body && hook1) {
      body = deriveBody(script, hook1);
    }

    issues = validateHookSplit(script, hook1, hook2, hook3, body);
    if (issues.length === 0) {
      break;
    }
  }

  if (issues.length > 0) {
    const err: HookSplitError = {
      message: "Hook split failed validation after retries.",
      phase: "hook_split",
      issues,
      attempts,
    };
    throw err;
  }

  return {
    hook1,
    hook2,
    hook3,
    body,
    hook_word_count: countWords(hook1),
    attempts,
  };
}