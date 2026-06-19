export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "untitled";
}

/** Human-facing MP4 filename derived from the Load page title field. */
export function videoFileName(title: string, slotNumber?: number): string {
  const slug = slugify(title);
  if (slotNumber != null) {
    return `${slug}-${slotNumber}.mp4`;
  }
  return `${slug}.mp4`;
}

export function videoStoragePath(
  funnelStage: string,
  number: number,
  title: string
): string {
  return `${funnelStage}/${videoFileName(title, number)}`;
}
