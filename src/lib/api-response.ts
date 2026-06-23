export async function readApiJson<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ").trim();
    if (res.status === 413 || preview.toLowerCase().includes("request entity too large")) {
      throw new Error(
        "Upload is too large for the serverless API route. Try again after the latest deploy, or use a smaller file."
      );
    }

    throw new Error(
      preview
        ? `Server returned an unexpected response (${res.status}): ${preview}`
        : `Server returned an unexpected empty response (${res.status}).`
    );
  }
}
