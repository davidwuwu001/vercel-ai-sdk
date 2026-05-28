import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/media/speech-to-text";
import type { SpeechToTextOptions } from "@/lib/media/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: { code: "MISSING_FILE", message: "Audio file is required" } },
        { status: 400 }
      );
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "audio.wav";
    const mimeType = file.type || "audio/wav";
    
    const options: SpeechToTextOptions = {
      file: buffer,
      fileName,
      mimeType,
      language: formData.get("language") as string | undefined,
      model: formData.get("model") as string | undefined,
      provider: formData.get("provider") as "openai" | "ark" | "bailian" | "mock" | undefined,
    };
    
    const result = await transcribeAudio(options);
    
    if (result.error && !result.text) {
      return NextResponse.json(
        { error: { code: "TRANSCRIPTION_FAILED", message: result.error } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/media/stt]", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
