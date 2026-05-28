import { NextResponse } from "next/server";
import { parseDocument, createError } from "@/lib/documents/parse";
import { DocumentParseErrorSchema, MIME_TYPES } from "@/lib/documents/types";
import { createRequestLogger, sanitize, incCounter } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const log = createRequestLogger(request);
  const startTime = Date.now();

  try {
    log.info("Document parse started");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      log.warn("No file provided");
      return NextResponse.json(
        {
          error: DocumentParseErrorSchema.parse(
            createError("MISSING_FILE", "No file provided in the request")
          ),
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || MIME_TYPES[file.name.split(".").pop() || ""] || "application/octet-stream";

    const parsedDocument = await parseDocument(buffer, file.name, mimeType);

    const latencyMs = Date.now() - startTime;
    incCounter("document_parses_total", { status: "success", fileType: mimeType });
    log.info("Document parsed successfully", { fileName: file.name, latencyMs });
    log.complete(200, latencyMs);

    return NextResponse.json({
      success: true,
      document: parsedDocument,
    });
  } catch (error) {
    const parseError = error as { code?: string; message: string; details?: string };
    const errorResponse = DocumentParseErrorSchema.safeParse(parseError);

    if (errorResponse.success) {
      const statusCode =
        parseError.code === "FILE_TOO_LARGE"
          ? 413
          : parseError.code === "UNSUPPORTED_FORMAT"
            ? 415
            : 400;

      incCounter("document_parses_total", { status: "error", code: parseError.code || "unknown" });
      log.error(error);
      log.complete(statusCode, Date.now() - startTime);

      return NextResponse.json({ error: errorResponse.data }, { status: statusCode });
    }

    incCounter("document_parses_total", { status: "error", code: "INTERNAL_ERROR" });
    log.error(error);
    log.complete(500, Date.now() - startTime);

    return NextResponse.json(
      {
        error: createError(
          "INTERNAL_ERROR",
          "An unexpected error occurred during document parsing",
          error instanceof Error ? sanitize(error.message) : undefined
        ),
      },
      { status: 500 }
    );
  }
}
