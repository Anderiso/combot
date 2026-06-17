"use client";

import { useEffect, useState } from "react";

type BrandProfile = {
  brand_title: string;
  product_description: string;
  target_audience: string;
};

export default function BrandPage() {
  const [profile, setProfile] = useState<BrandProfile>({
    brand_title: "",
    product_description: "",
    target_audience: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load brand profile.");
        }

        if (data.profile) {
          setProfile({
            brand_title: data.profile.brand_title ?? "",
            product_description: data.profile.product_description ?? "",
            target_audience: data.profile.target_audience ?? "",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save.");
      }

      setMessage("Brand profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Brand profile</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Used by the remix feature to tailor ad ideas to your brand.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Brand title</label>
          <textarea
            rows={2}
            value={profile.brand_title}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, brand_title: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Product description</label>
          <textarea
            rows={5}
            value={profile.product_description}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                product_description: e.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Target audience</label>
          <textarea
            rows={4}
            value={profile.target_audience}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, target_audience: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </main>
  );
}
