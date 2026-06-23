const TRANSCRIBE_TEMP_PREFIX = "transcribe-temp/";

export function createTranscribeTempPath(): string {
  return `${TRANSCRIBE_TEMP_PREFIX}${crypto.randomUUID()}.mp4`;
}

export function isTranscribeTempPath(path: string): boolean {
  return (
    path.startsWith(TRANSCRIBE_TEMP_PREFIX) &&
    path.endsWith(".mp4") &&
    !path.includes("..")
  );
}
