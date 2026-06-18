"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  clearWorkOrderBatch,
  loadWorkOrderBatch,
  MAX_WORK_ORDERS,
  removeWorkOrderItem,
  saveWorkOrderBatch,
  updateWorkOrderItem,
  type WorkOrderBatch,
  type WorkOrderItem,
} from "@/lib/work-order-persist";
import { downloadWorkOrdersPdf } from "@/lib/work-order-pdf";

type BrandProfile = {
  brand_title: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

function OrderCard({
  item,
  index,
  onChange,
  onRemove,
  onRetry,
  disabled,
}: {
  item: WorkOrderItem;
  index: number;
  onChange: (patch: Partial<WorkOrderItem>) => void;
  onRemove: () => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const isBusy = item.status === "pending" || item.status === "splitting";

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            #{index + 1}
          </h2>
          <p className="mt-1 font-mono text-sm text-violet-700 dark:text-violet-300">
            {item.videoFileName}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Team matches this filename to the reference video you send separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.status === "ready" && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Ready
            </span>
          )}
          {isBusy && (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              {item.status === "splitting" ? "Splitting hooks…" : "Queued…"}
            </span>
          )}
          {item.status === "error" && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              Error
            </span>
          )}
          {item.status === "error" && (
            <button
              type="button"
              onClick={onRetry}
              disabled={disabled}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Retry split
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled || isBusy}
            className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            Remove
          </button>
        </div>
      </div>

      {item.status === "error" && item.errorMessage && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {item.errorMessage}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <FieldLabel>Notes for your team</FieldLabel>
          <textarea
            value={item.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            disabled={isBusy}
            rows={2}
            placeholder="Direction, talent notes, CTA emphasis…"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {item.status === "ready" && (
          <>
            <div>
              <FieldLabel>Hook A (original)</FieldLabel>
              <textarea
                value={item.hook1}
                onChange={(e) => onChange({ hook1: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <FieldLabel>Hook B</FieldLabel>
              <textarea
                value={item.hook2}
                onChange={(e) => onChange({ hook2: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <FieldLabel>Hook C</FieldLabel>
              <textarea
                value={item.hook3}
                onChange={(e) => onChange({ hook3: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <FieldLabel>Body</FieldLabel>
              <textarea
                value={item.body}
                onChange={(e) => onChange({ body: e.target.value })}
                rows={8}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </>
        )}

        {isBusy && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            Claude is splitting the hook and generating variations…
          </div>
        )}
      </div>
    </article>
  );
}

export default function WorkOrdersPage() {
  const [hydrated, setHydrated] = useState(false);
  const [batch, setBatch] = useState<WorkOrderBatch>({ items: [] });
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const readyCount = batch.items.filter((item) => item.status === "ready").length;
  const pendingCount = batch.items.filter(
    (item) => item.status === "pending" || item.status === "splitting"
  ).length;

  const persistBatch = useCallback((next: WorkOrderBatch) => {
    setBatch(next);
    saveWorkOrderBatch(next);
  }, []);

  const splitItem = useCallback(
    async (item: WorkOrderItem) => {
      persistBatch(
        updateWorkOrderItem(item.id, {
          status: "splitting",
          errorMessage: null,
        })
      );

      try {
        const res = await fetch("/api/split-hooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: item.script }),
        });
        const data = await res.json();

        if (!res.ok) {
          const detail =
            data.issues?.length > 0
              ? `${data.message || data.error}\n${data.issues.join("\n")}`
              : data.error || data.message || "Hook split failed.";
          throw new Error(detail);
        }

        persistBatch(
          updateWorkOrderItem(item.id, {
            hook1: data.hook1 ?? "",
            hook2: data.hook2 ?? "",
            hook3: data.hook3 ?? "",
            body: data.body ?? "",
            status: "ready",
            errorMessage: null,
          })
        );
      } catch (err) {
        persistBatch(
          updateWorkOrderItem(item.id, {
            status: "error",
            errorMessage:
              err instanceof Error ? err.message : "Hook split failed.",
          })
        );
      }
    },
    [persistBatch]
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      let current = loadWorkOrderBatch();
      let pending = current.items.filter((item) => item.status === "pending");

      while (pending.length > 0) {
        const item = pending[0];
        await splitItem(item);
        current = loadWorkOrderBatch();
        pending = current.items.filter((i) => i.status === "pending");
      }
    } finally {
      processingRef.current = false;
    }
  }, [splitItem]);

  useEffect(() => {
    setBatch(loadWorkOrderBatch());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void processQueue();
  }, [hydrated, batch.items.length, processQueue]);

  useEffect(() => {
    async function loadBrand() {
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();
        if (res.ok && data.profile?.brand_title) {
          setBrand({ brand_title: data.profile.brand_title });
        }
      } catch {
        // Optional for PDF header.
      }
    }
    loadBrand();
  }, []);

  function handleItemChange(id: string, patch: Partial<WorkOrderItem>) {
    persistBatch(updateWorkOrderItem(id, patch));
  }

  function handleRemove(id: string) {
    persistBatch(removeWorkOrderItem(id));
  }

  function handleRetry(id: string) {
    persistBatch(
      updateWorkOrderItem(id, { status: "pending", errorMessage: null })
    );
    void processQueue();
  }

  function handleClearAll() {
    clearWorkOrderBatch();
    setBatch({ items: [] });
    setError(null);
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      await downloadWorkOrdersPdf(batch.items, brand?.brand_title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-sm text-zinc-500">Loading batch…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work orders</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Batch up to {MAX_WORK_ORDERS} remixed scripts, split hooks, then export one PDF.
            Send reference videos separately — filenames in the PDF match your uploads.
          </p>
        </div>
        {batch.items.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={pendingCount > 0 || exporting}
            className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            Clear batch
          </button>
        )}
      </div>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {batch.items.length}
          </span>{" "}
          / {MAX_WORK_ORDERS} slots ·{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            {readyCount} ready
          </span>
          {pendingCount > 0 && (
            <>
              {" "}
              ·{" "}
              <span className="font-medium text-violet-700 dark:text-violet-300">
                {pendingCount} processing
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/remix"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Add from Remix
          </Link>
          <button
            type="button"
            onClick={handleExport}
            disabled={readyCount === 0 || exporting || pendingCount > 0}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </section>

      {batch.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No work orders yet. Remix a script, then click{" "}
            <span className="font-medium">Add to work order batch</span> on the Remix page.
          </p>
          <Link
            href="/remix"
            className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Go to Remix
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {batch.items.map((item, index) => (
            <OrderCard
              key={item.id}
              item={item}
              index={index}
              disabled={exporting}
              onChange={(patch) => handleItemChange(item.id, patch)}
              onRemove={() => handleRemove(item.id)}
              onRetry={() => handleRetry(item.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm whitespace-pre-wrap text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
    </main>
  );
}
