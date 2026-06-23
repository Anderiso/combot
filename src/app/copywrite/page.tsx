"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FunnelStage } from "@/lib/database.types";

type BrandProfile = {
  brand_title: string;
  product_description: string;
  target_audience: string;
};

const STAGES: { value: FunnelStage; label: string; hint: string }[] = [
  {
    value: "TMOF",
    label: "TMOF",
    hint: "Top / middle of funnel. Hooks, pain, education, proof, demos.",
  },
  {
    value: "BOF",
    label: "BOF",
    hint: "Product-aware. Offers, urgency, buy now.",
  },
];

export default function CopywritePage() {
  const [funnelStage, setFunnelStage] = useState<FunnelStage>("TMOF");
  const [notes, setNotes] = useState("");
  const [script, setScript] = useState("");
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const brandComplete = useMemo(
    () =>
      Boolean(
        brand?.brand_title?.trim() &&
          brand?.product_description?.trim() &&
          brand?.target_audience?.trim()
      ),
    [brand]
  );

  const wordCount = useMemo(
    () => (script.trim() ? script.trim().split(/\s+/).length : 0),
    [script]
  );

  useEffect(() => {
    async function loadBrand() {
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load brand profile.");
        }
        if (data.profile) {
          setBrand({
            brand_title: data.profile.brand_title ?? "",
            product_description: data.profile.product_description ?? "",
            target_audience: data.profile.target_audience ?? "",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load brand.");
      } finally {
        setBrandLoading(false);
      }
    }

    loadBrand();
  }, []);

  async function handleGenerate() {
    if (!brandComplete) {
      setError("Complete your brand profile before generating a script.");
      return;
    }

    setGenerating(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch("/api/copywrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnel_stage: funnelStage,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Copywriting failed.");
      }

      setScript(data.script || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copywriting failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!script.trim()) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Copywrite</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Generate new ad scripts with AI, tailored to your brand and funnel stage.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {brandLoading ? (
              <span className="text-zinc-500">Loading brand…</span>
            ) : brandComplete ? (
              <span>
                <span className="font-medium">{brand?.brand_title}</span>
                <span className="mx-2 text-zinc-400">·</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {brand?.target_audience}
                </span>
              </span>
            ) : (
              <span className="text-amber-800 dark:text-amber-200">
                Brand profile incomplete —{" "}
                <Link href="/brand" className="underline">
                  set up first
                </Link>
              </span>
            )}
          </div>
          <Link
            href="/brand"
            className="shrink-0 text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Edit brand
          </Link>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Brief
          </h2>

          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Funnel stage
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {STAGES.map((stage) => {
                const selected = funnelStage === stage.value;
                return (
                  <label
                    key={stage.value}
                    className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                      selected
                        ? "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="funnel_stage"
                      value={stage.value}
                      checked={selected}
                      onChange={() => setFunnelStage(stage.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-semibold">{stage.label}</span>
                    <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                      {stage.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Notes <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={generating}
              rows={4}
              placeholder="Angle, hook idea, offer details, things to mention or avoid…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!brandComplete || generating}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Writing…" : script ? "Regenerate script" : "Write script"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Script
            </h2>
            {wordCount > 0 && (
              <span className="text-xs text-zinc-500">{wordCount} words</span>
            )}
          </div>

          {generating ? (
            <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
              <div>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                <p className="mt-3">Drafting and polishing your script…</p>
              </div>
            </div>
          ) : script ? (
            <>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={14}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-relaxed outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  {copied ? "Copied" : "Copy script"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
              Your copywritten script will appear here.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
