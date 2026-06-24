"use client";

import type { ConceptTag } from "@/lib/database.types";

type TagSelectProps = {
  tags: ConceptTag[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

export function TagSelect({
  tags,
  value,
  onChange,
  disabled,
  id,
}: TagSelectProps) {
  return (
    <select
      id={id}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <option value="">No tag</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.name}
        </option>
      ))}
    </select>
  );
}
