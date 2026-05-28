import {
  deleteModelConfig,
  modelConfigSchema,
  updateModelConfig,
} from "@/lib/models";

export const runtime = "nodejs";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = modelConfigSchema.parse(await req.json());
    const model = updateModelConfig(Number(id), data);
    return Response.json({ model });
  } catch (error) {
    return modelError(error);
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    deleteModelConfig(Number(id));
    return Response.json({ ok: true });
  } catch (error) {
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
    { message: error instanceof Error ? error.message : "模型配置操作失败" },
    { status: 400 },
  );
}

