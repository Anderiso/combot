export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdtemp, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import OpenAI from "openai";
import { extractAudio } from "@/lib/ffmpeg";
import { createServiceClient } from "@/lib/supabase/server";
import { isTranscribeTempPath } from "@/lib/transcribe-temp";

/** Whisper limit is 25 MB; compress to audio when above 24 MB. */
const AUDIO_CONVERSION_THRESHOLD_BYTES = 24 * 1024 * 1024;

async function cleanup(paths: string[]) {
  await Promise.all(
    paths.map((filePath) => unlink(filePath).catch(() => undefined))
  );
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];
  let tempDir: string | null = null;
  let storagePath: string | null = null;

  try {
    let body: { storage_path?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    storagePath = body.storage_path?.trim() ?? "";
    if (!storagePath || !isTranscribeTempPath(storagePath)) {
      return NextResponse.json(
        { error: "storage_path must point to a transcribe temp upload." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();
    const { data: blob, error: downloadError } = await supabase.storage
      .from("videos")
      .download(storagePath);

    if (downloadError || !blob) {
      return NextResponse.json(
        { error: downloadError?.message || "Could not read uploaded video." },
        { status: 404 }
      );
    }

    const videoBuffer = Buffer.from(await blob.arrayBuffer());

    if (videoBuffer.length === 0) {
      return NextResponse.json({ error: "Video file was empty." }, { status: 400 });
    }

    const fileSizeMb = videoBuffer.length / (1024 * 1024);
    const needsAudioConversion = videoBuffer.length > AUDIO_CONVERSION_THRESHOLD_BYTES;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let whisperFile: File;
    let usedAudio = false;

    if (needsAudioConversion) {
      tempDir = await mkdtemp(join(tmpdir(), "transcribe-"));
      const videoPath = join(tempDir, "input.mp4");
      const audioPath = join(tempDir, "audio.mp3");
      tempFiles.push(videoPath, audioPath);

      await writeFile(videoPath, videoBuffer);

      try {
        await extractAudio(videoPath, audioPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Audio extraction failed.";
        return NextResponse.json({ error: message }, { status: 500 });
      }

      const audioData = await readFile(audioPath);
      whisperFile = await OpenAI.toFile(audioData, "audio.mp3");
      usedAudio = true;
    } else {
      whisperFile = await OpenAI.toFile(videoBuffer, "input.mp4");
    }

    const transcription = await openai.audio.transcriptions.create({
      file: whisperFile,
      model: "whisper-1",
    });

    return NextResponse.json({
      transcript: transcription.text?.trim() ?? "",
      used_audio: usedAudio,
      file_size_mb: Math.round(fileSizeMb * 10) / 10,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempFiles.length > 0) {
      await cleanup(tempFiles);
    }
    if (tempDir) {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir).catch(() => undefined);
    }
    if (storagePath) {
      const supabase = createServiceClient();
      await supabase.storage.from("videos").remove([storagePath]);
    }
  }
}
