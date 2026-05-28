import {
  createModelConfig,
  listModelConfigs,
  modelConfigSchema,
} from "@/lib/models";
import { createRequestLogger, sanitize } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ models: listModelConfigs() });
}

export async function POST(req: Request) {
  const log = createRequestLogger(req);
  const startTime = Date.now();

  try {
    log.info("Model config create started");
    const data = modelConfigSchema.parse(await req.json());
    const model = createModelConfig(data);
    log.info("Model config created", { modelId: model.id });
    log.complete(201, Date.now() - startTime);
    return Response.json({ model }, { status: 201 });
  } catch (error) {
    log.error(error);
    log.complete(400, Date.now() - startTime);
    return modelError(error);
  }
}

function modelError(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ message?: string }>;
    return Response.json(
      { message: issues[0]?.message || "模型配置格式不正确", issues },
      { status: 400 },
    );
  }

  return Response.json(
    { message: error instanceof Error ? sanitize(error.message) : "模型配置保存失败" },
    { status: 400 },
  );
}

