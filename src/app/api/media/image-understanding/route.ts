/**
 * Image Understanding API
 * 
 * Dedicated endpoint for image analysis/understanding tasks.
 * This is separate from the chat endpoint and provides
 * specialized image analysis capabilities.
 */

import { NextResponse } from "next/server";
import { analyzeImage, getSupportedVisionModels } from "@/lib/media/image-understanding";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/media/image-understanding
 * 
 * Analyze an image and return structured description.
 * 
 * Request body:
 * - imageSource: string (URL or base64 encoded image)
 * - prompt?: string (custom analysis prompt)
 * - provider?: "ark" | "bailian" | "openai" | "anthropic" | "mock"
 * - model?: string (specific model to use)
 * - maxTokens?: number
 * - temperature?: number
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageSource, prompt, provider, model, maxTokens, temperature } = body;

    if (!imageSource) {
      return NextResponse.json(
        { error: "missing_image_source", message: "imageSource is required" },
        { status: 400 }
      );
    }

    // 验证图片源格式
    const isValidUrl =
      imageSource.startsWith("http://") ||
      imageSource.startsWith("https://");
    const isValidBase64 =
      imageSource.startsWith("data:") ||
      /^[A-Za-z0-9+/=]+$/.test(imageSource.slice(0, 100));

    if (!isValidUrl && !isValidBase64) {
      return NextResponse.json(
        {
          error: "invalid_image_format",
          message: "imageSource must be a valid URL or base64 encoded image",
        },
        { status: 400 }
      );
    }

    const result = await analyzeImage({
      imageSource,
      prompt: prompt || "请详细描述这张图片的内容，包括主要物体、场景、文字等。",
      provider: provider || "ark",
      model,
      maxTokens: maxTokens || 4096,
      temperature: temperature || 0.7,
    });

    if (result.error) {
      return NextResponse.json(
        {
          error: "analysis_failed",
          message: result.error,
          provider: result.provider,
          model: result.model,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      description: result.description,
      objects: result.objects,
      labels: result.labels,
      metadata: {
        provider: result.provider,
        model: result.model,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    console.error("[image-understanding] Error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/media/image-understanding
 * 
 * Get list of supported vision models.
 */
export async function GET() {
  const models = getSupportedVisionModels();

  return NextResponse.json({
    supportedModels: models,
    providerCount: new Set(models.map((m) => m.provider)).size,
    totalModels: models.length,
  });
}
