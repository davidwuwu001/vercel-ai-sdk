import { z } from "zod";

export const SUPPORTED_DOCUMENT_TYPES = [
  "md",
  "markdown",
  "pdf",
  "docx",
  "txt",
  "csv",
  "json",
] as const;
export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];

export const DocumentMetadataSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  documentType: z.enum(SUPPORTED_DOCUMENT_TYPES),
  pageCount: z.number().optional(),
  rowCount: z.number().optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const ParsedDocumentSchema = z.object({
  title: z.string().optional(),
  plainText: z.string(),
  markdown: z.string(),
  metadata: DocumentMetadataSchema,
  pages: z
    .array(
      z.object({
        pageNumber: z.number(),
        text: z.string(),
      }),
    )
    .optional(),
});

export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;

export const DocumentParseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
});

export type DocumentParseError = z.infer<typeof DocumentParseErrorSchema>;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const MIME_TYPES: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
};

export function getDocumentType(fileName: string): SupportedDocumentType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  if (SUPPORTED_DOCUMENT_TYPES.includes(ext as SupportedDocumentType)) {
    return ext as SupportedDocumentType;
  }

  return null;
}

export function isSupportedDocumentType(fileName: string): boolean {
  return getDocumentType(fileName) !== null;
}
