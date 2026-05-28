import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/media/text-to-speech";
import type { TextToSpeechOptions } from "@/lib/media/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<TextToSpeechOptions>;
    
    if (!body.text) {
      return NextResponse.json(
        { error: { code: "MISSING_TEXT", message: "Text is required" } },
        { status: 400 }
      );
    }
    
    const options: TextToSpeechOptions = {
      text: body.text,
      model: body.model,
      voice: body.voice,
      speed: body.speed || 1.0,
      format: body.format || "mp3",
      provider: body.provider,
    };
    
    const result = await synthesizeSpeech(options);
    
    if (result.error && !result.audioBase64 && !result.audioUrl) {
      return NextResponse.json(
        { error: { code: "SYNTHESIS_FAILED", message: result.error } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/media/tts]", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
