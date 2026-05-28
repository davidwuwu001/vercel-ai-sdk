import { DocumentParseError, DocumentMetadata, ParsedDocument, getDocumentType } from "./types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function createError(code: string, message: string, details?: string): DocumentParseError {
  return { code, message, details };
}

function extractTitleFromMarkdown(text: string): string | undefined {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }
  return undefined;
}

function extractTitleFromPlainText(text: string): string | undefined {
  const firstLine = text.split("\n")[0]?.trim();
  if (firstLine && firstLine.length > 0 && firstLine.length < 200) {
    return firstLine.slice(0, 100);
  }
  return undefined;
}

async function parseMarkdown(buffer: Buffer): Promise<{ title?: string; plainText: string; markdown: string }> {
  const content = buffer.toString("utf-8");
  return {
    title: extractTitleFromMarkdown(content),
    plainText: content,
    markdown: content,
  };
}

async function parsePlainText(buffer: Buffer, fileName: string): Promise<{ title?: string; plainText: string; markdown: string }> {
  const content = buffer.toString("utf-8");
  return {
    title: extractTitleFromPlainText(content) || fileName.replace(/\.txt$/i, ""),
    plainText: content,
    markdown: `\`\`\`text\n${content}\n\`\`\``,
  };
}

async function parseCsv(buffer: Buffer, fileName: string): Promise<{ title?: string; plainText: string; markdown: string; rowCount: number }> {
  const content = buffer.toString("utf-8");
  const rows = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const markdown = rows.length
    ? `\`\`\`csv\n${content}\n\`\`\``
    : "";

  return {
    title: fileName.replace(/\.csv$/i, ""),
    plainText: content,
    markdown,
    rowCount: rows.length,
  };
}

async function parseJson(buffer: Buffer, fileName: string): Promise<{ title?: string; plainText: string; markdown: string }> {
  const content = buffer.toString("utf-8");

  try {
    const parsed = JSON.parse(content) as unknown;
    const pretty = JSON.stringify(parsed, null, 2);
    return {
      title: fileName.replace(/\.json$/i, ""),
      plainText: pretty,
      markdown: `\`\`\`json\n${pretty}\n\`\`\``,
    };
  } catch (error) {
    throw createError(
      "JSON_PARSE_ERROR",
      "Failed to parse JSON file",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function parseDocx(buffer: Buffer, fileName: string): Promise<{ title?: string; plainText: string; markdown: string }> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const plainText = result.value;
    const markdown = plainText;
    const title = extractTitleFromPlainText(plainText) || fileName.replace(/\.docx$/i, "");

    return { title, plainText, markdown };
  } catch (error) {
    throw createError(
      "DOCX_PARSE_ERROR",
      "Failed to parse DOCX file",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function parsePdf(buffer: Buffer, fileName: string): Promise<{ title?: string; plainText: string; markdown: string; pages: { pageNumber: number; text: string }[] }> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const fullText = result.text || "";
    const markdown = fullText;
    const title = extractTitleFromPlainText(fullText) || fileName.replace(/\.pdf$/i, "");

    const pages: { pageNumber: number; text: string }[] = [];
    if (result.pages && Array.isArray(result.pages)) {
      for (let i = 0; i < result.pages.length; i++) {
        const page = result.pages[i];
        const pageText = typeof page === "string" ? page : (page.text || "");
        pages.push({
          pageNumber: i + 1,
          text: pageText,
        });
      }
    } else {
      const pageTexts = fullText.split(/\f/);
      pageTexts.forEach((text, index) => {
        if (text.trim()) {
          pages.push({
            pageNumber: index + 1,
            text: text.trim(),
          });
        }
      });
      if (pages.length === 0 && fullText) {
        pages.push({
          pageNumber: 1,
          text: fullText,
        });
      }
    }

    return { title, plainText: fullText, markdown, pages };
  } catch (error) {
    throw createError(
      "PDF_PARSE_ERROR",
      "Failed to parse PDF file",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedDocument> {
  const fileSize = buffer.length;
  if (fileSize > MAX_FILE_SIZE) {
    throw createError(
      "FILE_TOO_LARGE",
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      `Actual file size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`
    );
  }

  const documentType = getDocumentType(fileName);
  if (!documentType) {
    throw createError(
      "UNSUPPORTED_FORMAT",
      `Unsupported file format: ${fileName}`,
      `Supported formats: .md, .markdown, .pdf, .docx, .txt, .csv, .json`
    );
  }

  const baseMetadata: DocumentMetadata = {
    fileName,
    fileSize,
    mimeType,
    documentType,
    createdAt: new Date().toISOString(),
  };

  let parseResult: {
    title?: string;
    plainText: string;
    markdown: string;
    pages?: { pageNumber: number; text: string }[];
    rowCount?: number;
  };

  switch (documentType) {
    case "md":
    case "markdown":
      parseResult = await parseMarkdown(buffer);
      break;
    case "txt":
      parseResult = await parsePlainText(buffer, fileName);
      break;
    case "csv":
      parseResult = await parseCsv(buffer, fileName);
      baseMetadata.rowCount = parseResult.rowCount;
      break;
    case "json":
      parseResult = await parseJson(buffer, fileName);
      break;
    case "docx":
      parseResult = await parseDocx(buffer, fileName);
      break;
    case "pdf":
      parseResult = await parsePdf(buffer, fileName);
      baseMetadata.pageCount = parseResult.pages?.length;
      break;
    default:
      throw createError(
        "UNSUPPORTED_FORMAT",
        `Unsupported document type: ${documentType}`
      );
  }

  return {
    title: parseResult.title,
    plainText: parseResult.plainText,
    markdown: parseResult.markdown,
    metadata: baseMetadata,
    pages: parseResult.pages,
  };
}

export { createError };
