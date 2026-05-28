import { editAndRegenerate, editMessageSchema } from "@/lib/ai/edit";
import type { UIMessage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = editMessageSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { sessionId, messageId, newContent, modelConfigId } = parsed.data;

    // Get messages from the session
    // In a real implementation, you would fetch from database
    // For now, we return the stream response directly
    const messages: UIMessage[] = [];

    // For client-side handling, we return a response that indicates
    // the edit should be handled by the client
    return Response.json({
      success: true,
      action: "edit_and_regenerate",
      sessionId,
      messageId,
      newContent,
      modelConfigId,
      // The client will handle the actual regeneration
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error occurred";

    return Response.json({ success: false, message }, { status: 500 });
  }
}
