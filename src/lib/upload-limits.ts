/** Max MP4 size for library saves (200 MB). */
export const LIBRARY_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export const LIBRARY_VIDEO_MAX_MB = 200;

export function formatFileSizeMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function isWithinLibraryVideoLimit(bytes: number): boolean {
  return bytes <= LIBRARY_VIDEO_MAX_BYTES;
}

export function libraryVideoSizeError(file: File): string | null {
  if (isWithinLibraryVideoLimit(file.size)) {
    return null;
  }

  return `Video is ${formatFileSizeMb(file.size)} MB — library uploads are limited to ${LIBRARY_VIDEO_MAX_MB} MB. Compress the file or trim the video before saving.`;
}

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export function getSupabaseStorageSettingsUrl(): string {
  const ref = getSupabaseProjectRef();
  if (ref) {
    return `https://supabase.com/dashboard/project/${ref}/storage/settings`;
  }
  return "https://supabase.com/dashboard/project/_/storage/settings";
}

export function supabaseStorageSizeError(file: File): string {
  const fileMb = formatFileSizeMb(file.size);
  const settingsUrl = getSupabaseStorageSettingsUrl();

  if (file.size > LIBRARY_VIDEO_MAX_BYTES) {
    return `Upload failed: video is ${fileMb} MB, which exceeds the ${LIBRARY_VIDEO_MAX_MB} MB app limit.`;
  }

  return (
    `Upload failed: your video is ${fileMb} MB (under the ${LIBRARY_VIDEO_MAX_MB} MB app limit), ` +
    `but Supabase rejected it — the project's global file size limit is likely still at 50 MB. ` +
    `Open Storage → Settings and set "Global file size limit" to at least ${LIBRARY_VIDEO_MAX_MB} MB:\n` +
    settingsUrl
  );
}
