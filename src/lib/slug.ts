export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return slug || "untitled";
}

export function videoStoragePath(
  funnelStage: string,
  number: number,
  title: string
): string {
  return `${funnelStage}/${number}-${slugify(title)}.mp4`;
}
