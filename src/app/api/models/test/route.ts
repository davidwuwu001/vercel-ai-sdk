import { generateText } from "ai";
import { getChatModel, getActiveModelConfig } from "@/lib/ai/model";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const modelConfigId = body.modelConfigId ? Number(body.modelConfigId) : undefined;
    const config = getActiveModelConfig(modelConfigId);

    const result = await generateText({
      model: getChatModel(modelConfigId),
      prompt: "请只回复：模型连接正常。",
      temperature: 0,
      maxOutputTokens: 32,
    });

    return Response.json({
      success: true,
      latencyMs: Date.now() - startedAt,
      provider: config.provider,
      modelId: config.modelId,
      text: result.text,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[models/test] error:", error);
    return Response.json(
      {
        success: false,
        latencyMs: Date.now() - startedAt,
        message: formatModelTestError(error),
      },
      { status: 400 },
    );
  }
}

function formatModelTestError(error: unknown) {
  const message = error instanceof Error ? error.message : "模型连接测试失败";

  if (message.includes("Missing API key")) {
    return `${message} 请检查 .env.local 或模型后台 API Key 配置。`;
  }

  if (message.includes("Selected model is disabled")) {
    return "当前模型不存在或已禁用，请在模型管理后台重新选择。";
  }

  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
    return "模型服务连接失败，请检查 Base URL、网络代理或供应商服务状态。";
  }

  return message;
}
