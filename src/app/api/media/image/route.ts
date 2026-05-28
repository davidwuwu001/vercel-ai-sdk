import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/media/image-generation";
import type { ImageGenerationOptions } from "@/lib/media/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<ImageGenerationOptions>;
    
    if (!body.prompt) {
      return NextResponse.json(
        { error: { code: "MISSING_PROMPT", message: "Prompt is required" } },
        { status: 400 }
      );
    }
    
    const options: ImageGenerationOptions = {
      prompt: body.prompt,
      model: body.model,
      size: body.size || "1024x1024",
      quality: body.quality,
      style: body.style,
      n: body.n || 1,
      provider: body.provider,
    };
    
    const result = await generateImage(options);
    
    if (result.error && !result.url && !result.base64) {
      return NextResponse.json(
        { error: { code: "GENERATION_FAILED", message: result.error } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/media/image]", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
