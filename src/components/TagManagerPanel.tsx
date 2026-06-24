"use client";

import { useCallback, useState } from "react";
import type { ConceptTag } from "@/lib/database.types";
import { readApiJson } from "@/lib/api-response";

type TagManagerPanelProps = {
  open: boolean;
  tags: ConceptTag[];
  onClose: () => void;
  onTagsChange: (tags: ConceptTag[]) => void;
};

export function TagManagerPanel({
  open,
  tags,
  onClose,
  onTagsChange,
}: TagManagerPanelProps) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetEditing() {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
  }

  const createTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newTagDescription.trim() || null,
        }),
      });
      const data = await readApiJson<{ error?: string; tag?: ConceptTag }>(res);

      if (!res.ok || !data.tag) {
        throw new Error(data.error || "Could not create tag.");
      }

      onTagsChange([...tags, data.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName("");
      setNewTagDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tag.");
    } finally {
      setCreating(false);
    }
  }, [newTagDescription, newTagName, onTagsChange, tags]);

  const saveTag = useCallback(
    async (id: string) => {
      const name = editingName.trim();
      if (!name) return;

      setSavingId(id);
      setError(null);

      try {
        const res = await fetch(`/api/tags/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: editingDescription.trim() || null,
          }),
        });
        const data = await readApiJson<{ error?: string; tag?: ConceptTag }>(res);

        if (!res.ok || !data.tag) {
          throw new Error(data.error || "Could not update tag.");
        }

        onTagsChange(
          tags
            .map((tag) => (tag.id === id ? data.tag! : tag))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        resetEditing();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update tag.");
      } finally {
        setSavingId(null);
      }
    },
    [editingDescription, editingName, onTagsChange, tags]
  );

  const deleteTag = useCallback(
    async (tag: ConceptTag) => {
      const confirmed = window.confirm(
        `Delete tag "${tag.name}"? Entries using it will become untagged.`
      );
      if (!confirmed) return;

      setDeletingId(tag.id);
      setError(null);

      try {
        const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
        const data = await readApiJson<{ error?: string }>(res);

        if (!res.ok) {
          throw new Error(data.error || "Could not delete tag.");
        }

        onTagsChange(tags.filter((item) => item.id !== tag.id));
        if (editingId === tag.id) {
          resetEditing();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete tag.");
      } finally {
        setDeletingId(null);
      }
    },
    [editingId, onTagsChange, tags]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close tag manager"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Manage tags</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tags group concepts across TMOF and BOF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6 space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              New tag
            </p>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name…"
              disabled={creating}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <textarea
              rows={3}
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              placeholder="Description (optional)…"
              disabled={creating}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={createTag}
              disabled={creating || !newTagName.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {creating ? "Adding…" : "Add tag"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {tags.length === 0 ? (
            <p className="text-sm text-zinc-500">No tags yet. Create one above.</p>
          ) : (
            <ul className="space-y-3">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  {editingId === tag.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        disabled={savingId === tag.id}
                        placeholder="Tag name…"
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <textarea
                        rows={3}
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        disabled={savingId === tag.id}
                        placeholder="Description (optional)…"
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveTag(tag.id)}
                          disabled={savingId === tag.id || !editingName.trim()}
                          className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={resetEditing}
                          className="rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-medium">{tag.name}</span>
                        {tag.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                            {tag.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditingName(tag.name);
                            setEditingDescription(tag.description ?? "");
                            setError(null);
                          }}
                          className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTag(tag)}
                          disabled={deletingId === tag.id}
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
                        >
                          {deletingId === tag.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
