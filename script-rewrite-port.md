# Script Rewrite — Port Guide

This document captures **only** the AdRemix script-rewrite workflow: take an original ad transcript and produce a brand-swapped rewrite that mirrors structure, hooks, and pacing. It does **not** cover segmentation, partitioning, or video prompts.

Source of truth: `app.py` in this repo (`_script_rewrite_prompt`, `/api/rewrite` Phase 1).

---

## What it does

1. Accept the **original script** (transcript) and **brand profile** fields.
2. Count words in the original script.
3. Call Claude with a tightly scoped prompt: **tight brand swap**, not a from-scratch rewrite.
4. Validate the output stays within a **±20 word** budget of the original.
5. Retry up to **3 times** with corrective feedback if validation fails.
6. As a last resort, **trim from the end** at sentence boundaries if the script is still too long.

The rewrite should:

- Mirror the original ad's structure, hooks, and pacing.
- Swap brand names and product references where needed.
- Replace benefits **in place** — only where the original already mentioned a benefit.
- **Not** pile on extra benefits from the brand profile.
- **Not** exceed the word budget (net length stays flat).

---

## API inputs

### Required

| Field | Type | Description |
|-------|------|-------------|
| `transcript` | string | The original ad script / voiceover transcript to remix |
| `brand_name` | string | Your brand name |
| `product_description` | string | What your product does, who it's for |
| `target_audience` | string | Who the remixed ad speaks to |
| `tone` | string | Voice/tone for this specific ad (e.g. "urgent, conversational, TikTok-native") |

### Not needed for rewrite-only

The full `/api/rewrite` route in AdRemix also accepts `duration`, `segment_length`, and `target_wpm` because it immediately partitions the script into timed chunks afterward. **For rewrite-only, ignore those.** Word-count targets are derived entirely from the original transcript length.

---

## Word budget (validation)

```python
ORIGINAL_LENGTH_TOLERANCE = 20

original_word_count = len(transcript.split())
total_word_target = original_word_count
total_word_min = max(1, original_word_count - ORIGINAL_LENGTH_TOLERANCE)
total_word_max = original_word_count + ORIGINAL_LENGTH_TOLERANCE
```

Word counting is whitespace-split (same as JavaScript `text.split(/\s+/)` on non-empty strings):

```python
def count_words(text: str) -> int:
    return len((text or "").split())
```

---

## Anthropic API call

### Environment

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6          # default in AdRemix
REWRITE_MAX_TOKENS=8192                 # default
SCRIPT_MAX_ATTEMPTS=3                   # default
```

### SDK (Python)

```python
from anthropic import Anthropic

client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

msg = client.messages.create(
    model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
    max_tokens=int(os.getenv("REWRITE_MAX_TOKENS", "8192")),
    messages=[{"role": "user", "content": prompt}],
)

if msg.stop_reason == "max_tokens":
    raise RuntimeError("Claude response was cut off — please retry.")

raw_text = msg.content[0].text
```

### REST equivalent

```http
POST https://api.anthropic.com/v1/messages
Content-Type: application/json
x-api-key: $ANTHROPIC_API_KEY
anthropic-version: 2023-06-01

{
  "model": "claude-sonnet-4-6",
  "max_tokens": 8192,
  "messages": [
    {
      "role": "user",
      "content": "<prompt string from section below>"
    }
  ]
}
```

There is **no system message**. The entire instruction lives in the single user message.

---

## Exact prompt template

Variables injected at runtime:

- `{original_word_count}` — word count of `transcript`
- `{min_w}` — `total_word_min`
- `{max_w}` — `total_word_max`
- `{total_target}` — `total_word_target` (same as `original_word_count`)
- `{tol}` — `ORIGINAL_LENGTH_TOLERANCE` (20)
- `{transcript}` — original script
- `{brand_name}`, `{product_description}`, `{target_audience}`, `{tone}` — brand profile
- `{retry_block}` — empty on first attempt; on retries, contains the fix-request block (see Retry feedback)

```
You are an elite direct-response ad copywriter who specialises in short-form video ads.

GOAL — TIGHT BRAND SWAP:
Mirror the original ad's structure, hooks, and pacing. Do not rewrite from scratch or pad
with extra copy.

BENEFITS — replace in place, never pile on:
The original ad already mentions benefits. For each one, either (a) swap it for a relevant
benefit from the brand profile below, or (b) leave it as-is if it's close enough to your product.
Do NOT add benefits that weren't in the original. Do NOT try to fit every benefit listed in
the brand profile — you are replacing what the original already said, not expanding the list.

WORD BUDGET (hard limit — validated):
- Original: {original_word_count} words → yours MUST be {min_w}–{max_w} (ideal {total_target}, ±{tol})
- NEVER exceed {max_w}. When in doubt, write shorter.
- Add a phrase only if you remove one elsewhere. Net length stays flat.

== ORIGINAL TRANSCRIPT ({original_word_count} words) ==
{transcript}

== NEW BRAND ==
Name: {brand_name}
Product: {product_description}
Target audience: {target_audience}
Tone/voice: {tone}
{retry_block}
== OUTPUT (strict JSON, no markdown fences) ==
{
  "full_script": "the complete rewritten script as one continuous piece of spoken copy",
  "word_count": {total_target}
}

Set word_count to the exact number of words in full_script. Return ONLY the JSON object.
```

### Retry block format

On attempts 2+, append this block where `{retry_block}` goes (including the `== FIX REQUEST ==` header):

```
== FIX REQUEST ==
{retry_feedback}
```

---

## Expected JSON response

```json
{
  "full_script": "Your complete rewritten spoken script as one string...",
  "word_count": 142
}
```

`word_count` is requested in the prompt but **the server re-counts words itself** and does not trust Claude's number for validation.

---

## Response parsing

Claude sometimes wraps JSON in markdown fences. Strip them before parsing:

```python
import json

def strip_json_fences(text: str) -> str:
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.lstrip().startswith("json"):
            raw = raw.split("\n", 1)[1]
    if raw.rstrip().endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    return raw.strip()

def parse_json_object(text: str) -> dict:
    raw = strip_json_fences(text)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(raw[start:end])
        raise
```

Extract the script:

```python
result = parse_json_object(msg.content[0].text)
full_script = (result.get("full_script") or "").strip()
```

---

## Validation

```python
def validate_full_script(full_script: str, original_word_count: int, tolerance: int = 20) -> list[str]:
    issues = []
    text = (full_script or "").strip()
    if not text:
        return ["full_script is missing or empty"]

    total_words = len(text.split())
    total_min = max(1, original_word_count - tolerance)
    total_max = original_word_count + tolerance

    if total_words < total_min:
        issues.append(
            f"full script has {total_words} words — must stay within "
            f"{original_word_count} ±{tolerance} (min {total_min})"
        )
    if total_words > total_max:
        issues.append(
            f"full script has {total_words} words — must stay within "
            f"{original_word_count} ±{tolerance} (max {total_max})"
        )
    return issues
```

---

## Retry feedback (injected on attempts 2–3)

When validation fails, build this string and pass it as `{retry_feedback}`:

```python
def build_script_retry_feedback(
    issues: list[str],
    full_script: str,
    original_word_count: int,
    tolerance: int = 20,
) -> str:
    wc = len(full_script.split())
    target = original_word_count
    min_w = max(1, original_word_count - tolerance)
    max_w = original_word_count + tolerance

    if wc > max_w:
        action = (
            f"TOO LONG by {wc - max_w} words. Hard ceiling is {max_w} words — you MUST delete "
            f"at least {wc - max_w} words. Tighten sentences, cut redundant lines, do not add anything new."
        )
    elif wc < min_w:
        action = (
            f"TOO SHORT by {min_w - wc} words. Add at least {min_w - wc} words without changing structure."
        )
    else:
        action = f"Aim for exactly {target} words (allowed range {min_w}–{max_w})."

    preview = full_script
    if len(preview) > 4000:
        preview = preview[:4000] + "\n… (truncated)"

    return (
        "Your previous full_script FAILED the word-count check:\n- "
        + "\n- ".join(issues)
        + f"\n\nYou returned {wc} words. Required range: {min_w}–{max_w} "
        f"(ideal {target}, ±{tolerance}).\n{action}\n\n"
        "Edit the script below — same message and tone, but hit the word budget. "
        "Replace existing benefits only — do not add new ones from the brand profile.\n\n"
        "YOUR PREVIOUS SCRIPT:\n"
        + preview
    )
```

Note the retry reinforces the core rules: **same message and tone**, hit word budget, **replace benefits only — do not add new ones**.

---

## Server-side trim fallback

If all retries still fail **only because the script is too long**, trim from the end at sentence/clause boundaries before giving up:

```python
def trim_script_to_max_words(full_script: str, max_words: int) -> str:
    words = full_script.split()
    if len(words) <= max_words:
        return full_script

    for cut in range(max_words, max(max_words - 30, 1), -1):
        if cut <= 0:
            break
        if words[cut - 1].endswith((".", "!", "?", "…")) or (
            cut < len(words) and words[cut - 1].endswith(",")
        ):
            return " ".join(words[:cut])

    return " ".join(words[:max_words])
```

After trimming, re-run validation. If it passes, return the trimmed script (AdRemix sets `script_trimmed: true` in metadata when this happens).

---

## Full rewrite-only flow (pseudocode)

```
function rewrite_script(transcript, brand_name, product_description, target_audience, tone):
    original_word_count = count_words(transcript)
    min_w = max(1, original_word_count - 20)
    max_w = original_word_count + 20

    plan = {
        total_word_target: original_word_count,
        total_word_min: min_w,
        total_word_max: max_w,
    }

    full_script = ""
    issues = []

    for attempt in 1..3:
        retry_feedback = ""
        if attempt > 1 and issues:
            retry_feedback = build_script_retry_feedback(issues, full_script, original_word_count)

        prompt = build_prompt(transcript, brand fields, plan, retry_feedback)
        result = call_claude_json(prompt, max_tokens=8192)
        full_script = strip(result.full_script)
        issues = validate_full_script(full_script, original_word_count)
        if issues is empty:
            break

    if issues and count_words(full_script) > max_w:
        full_script = trim_script_to_max_words(full_script, max_w)
        issues = validate_full_script(full_script, original_word_count)

    if issues:
        throw error with issues, attempt count, and word count

    return {
        full_script: full_script,
        word_count: count_words(full_script),
        script_attempts: attempt,
    }
```

---

## Suggested standalone route

If you are not porting the full AdRemix app, expose a minimal endpoint like this:

### `POST /api/rewrite-script`

**Request body:**

```json
{
  "transcript": "Hey guys, if you're struggling with bloating...",
  "brand_name": "GutGlow",
  "product_description": "Daily probiotic softgel for digestive comfort and less bloating",
  "target_audience": "Women 25-45 with gut issues",
  "tone": "Friendly, direct, like talking to a friend on TikTok"
}
```

**Success response (`200`):**

```json
{
  "full_script": "Hey guys, if you're struggling with bloating...",
  "word_count": 138,
  "script_attempts": 1,
  "meta": {
    "original_word_count": 140,
    "total_word_target": 140,
    "total_word_min": 120,
    "total_word_max": 160
  }
}
```

**Failure response (`500`):**

```json
{
  "message": "Script rewrite failed length validation after retry.",
  "phase": "script",
  "issues": ["full script has 172 words — must stay within 140 ±20 (max 160)"],
  "attempts": 3,
  "word_count": 172
}
```

---

## Reference implementation (Python, rewrite-only)

Drop-in functions matching AdRemix behavior for Phase 1 only:

```python
import os
import json
from anthropic import Anthropic

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
REWRITE_MAX_TOKENS = int(os.getenv("REWRITE_MAX_TOKENS", "8192"))
SCRIPT_MAX_ATTEMPTS = int(os.getenv("SCRIPT_MAX_ATTEMPTS", "3"))
ORIGINAL_LENGTH_TOLERANCE = 20


def script_rewrite_prompt(
    *,
    transcript: str,
    brand_name: str,
    product_description: str,
    target_audience: str,
    tone: str,
    original_word_count: int,
    total_word_target: int,
    total_word_min: int,
    total_word_max: int,
    retry_feedback: str = "",
) -> str:
    tol = ORIGINAL_LENGTH_TOLERANCE
    retry_block = f"\n== FIX REQUEST ==\n{retry_feedback}\n" if retry_feedback else ""

    return f"""You are an elite direct-response ad copywriter who specialises in short-form video ads.

GOAL — TIGHT BRAND SWAP:
Mirror the original ad's structure, hooks, and pacing. Do not rewrite from scratch or pad
with extra copy.

BENEFITS — replace in place, never pile on:
The original ad already mentions benefits. For each one, either (a) swap it for a relevant
benefit from the brand profile below, or (b) leave it as-is if it's close enough to your product.
Do NOT add benefits that weren't in the original. Do NOT try to fit every benefit listed in
the brand profile — you are replacing what the original already said, not expanding the list.

WORD BUDGET (hard limit — validated):
- Original: {original_word_count} words → yours MUST be {total_word_min}–{total_word_max} (ideal {total_word_target}, ±{tol})
- NEVER exceed {total_word_max}. When in doubt, write shorter.
- Add a phrase only if you remove one elsewhere. Net length stays flat.

== ORIGINAL TRANSCRIPT ({original_word_count} words) ==
{transcript}

== NEW BRAND ==
Name: {brand_name}
Product: {product_description}
Target audience: {target_audience}
Tone/voice: {tone}
{retry_block}
== OUTPUT (strict JSON, no markdown fences) ==
{{
  "full_script": "the complete rewritten script as one continuous piece of spoken copy",
  "word_count": {total_word_target}
}}

Set word_count to the exact number of words in full_script. Return ONLY the JSON object."""


def call_claude_json(client: Anthropic, prompt: str, max_tokens: int) -> dict:
    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("Claude response was cut off — please retry.")
    return parse_json_object(msg.content[0].text)


def rewrite_script(
    *,
    transcript: str,
    brand_name: str,
    product_description: str,
    target_audience: str,
    tone: str,
    client: Anthropic | None = None,
) -> dict:
    client = client or Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    original_word_count = len(transcript.split())
    plan = {
        "original_word_count": original_word_count,
        "total_word_target": original_word_count,
        "total_word_min": max(1, original_word_count - ORIGINAL_LENGTH_TOLERANCE),
        "total_word_max": original_word_count + ORIGINAL_LENGTH_TOLERANCE,
    }

    full_script = ""
    script_issues: list[str] = []
    script_attempts = 0
    script_trimmed = False

    for attempt in range(SCRIPT_MAX_ATTEMPTS):
        feedback = ""
        if attempt > 0 and script_issues:
            feedback = build_script_retry_feedback(script_issues, full_script, original_word_count)

        result = call_claude_json(
            client,
            script_rewrite_prompt(
                transcript=transcript,
                brand_name=brand_name,
                product_description=product_description,
                target_audience=target_audience,
                tone=tone,
                original_word_count=original_word_count,
                total_word_target=plan["total_word_target"],
                total_word_min=plan["total_word_min"],
                total_word_max=plan["total_word_max"],
                retry_feedback=feedback,
            ),
            REWRITE_MAX_TOKENS,
        )
        script_attempts = attempt + 1
        full_script = (result.get("full_script") or "").strip()
        script_issues = validate_full_script(full_script, original_word_count)
        if not script_issues:
            break

    if script_issues and len(full_script.split()) > plan["total_word_max"]:
        full_script = trim_script_to_max_words(full_script, plan["total_word_max"])
        script_issues = validate_full_script(full_script, original_word_count)
        if not script_issues:
            script_trimmed = True

    if script_issues:
        raise RuntimeError({
            "message": "Script rewrite failed length validation after retry.",
            "phase": "script",
            "issues": script_issues,
            "attempts": script_attempts,
            "word_count": len(full_script.split()),
        })

    return {
        "full_script": full_script,
        "word_count": len(full_script.split()),
        "script_attempts": script_attempts,
        "script_trimmed": script_trimmed,
        "meta": plan,
    }
```

(Uses `parse_json_object`, `validate_full_script`, `build_script_retry_feedback`, and `trim_script_to_max_words` from the sections above.)

---

## TypeScript / fetch port (minimal)

```typescript
const ORIGINAL_LENGTH_TOLERANCE = 20;

async function callClaudeRewrite(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
      max_tokens: Number(process.env.REWRITE_MAX_TOKENS ?? 8192),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.stop_reason === "max_tokens") {
    throw new Error("Claude response was cut off");
  }
  return data.content[0].text;
}
```

Build the prompt string with the exact template above, parse JSON from the response, then run the same validation / retry / trim loop.

---

## Behavioral checklist (must match)

To get identical behavior in another project, preserve all of these:

| Behavior | Detail |
|----------|--------|
| Single user message | No system prompt; all instructions in one user turn |
| Tight brand swap | Prompt explicitly forbids from-scratch rewrites and padding |
| Benefits in place only | Do not add benefits not present in the original |
| Word budget | Output must be within `original ± 20` words |
| Net length flat | "Add a phrase only if you remove one elsewhere" |
| JSON output | `full_script` + `word_count`; no markdown fences |
| Server-side word count | Validate with `split()`, don't trust Claude's `word_count` |
| Up to 3 attempts | Re-prompt with fix request including previous script |
| Retry reinforces rules | Same message/tone, replace benefits only, hit word budget |
| Trim fallback | If still too long after retries, trim at sentence boundaries |
| Model default | `claude-sonnet-4-6` |
| Max tokens | `8192` |

---

## What AdRemix does after rewrite (out of scope)

The production `/api/rewrite` route continues into **Phase 2: partition** — splitting `full_script` into timed segments for video generation. That uses a separate prompt (`_partition_prompt`) and is intentionally excluded here. If you only need the rewritten script, stop after Phase 1 and return `full_script`.
