/**
 * Knowledge Base Search
 * 
 * 基于 SQLite 的向量搜索实现
 * 使用 Cosine Similarity 进行相似度计算
 * 
 * 后续可升级为 sqlite-vec 以获得更好的性能
 */

import { getDb } from "@/lib/db";
import { embedTexts, cosineSimilarity } from "./embedding-provider";
import { rerank, isRerankAvailable } from "./rerank-provider";
import type { Chunk, ChunkConfig } from "./chunk";
import { chunkText } from "./chunk";

export interface SearchResult {
  chunk: Chunk;
  score: number;
  documentId: number;
  documentName?: string;
}

export interface SearchOptions {
  /** 返回结果数量 */
  topK?: number;
  /** 相似度阈值 */
  threshold?: number;
  /** 是否启用 Rerank */
  enableRerank?: boolean;
  /** 文档 ID 过滤 (可选) */
  documentId?: number;
  /** 文档 ID 列表过滤 (可选) */
  documentIds?: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalCandidates: number;
  rerankEnabled: boolean;
  provider: string;
}

/** 默认搜索配置 */
const DEFAULT_SEARCH_OPTIONS: Omit<Required<SearchOptions>, "documentId" | "documentIds"> & { documentId?: number; documentIds?: number[] } = {
  topK: 5,
  threshold: 0.5,
  enableRerank: true,
  documentId: undefined,
  documentIds: undefined,
};

/**
 * 确保搜索所需的数据库表存在
 */
export function ensureSearchSchema() {
  const db = getDb();
  
  db.exec(`
    -- 文档表
    CREATE TABLE IF NOT EXISTS kb_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'text',
      source_url TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 分块表
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id TEXT PRIMARY KEY,
      document_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_type TEXT NOT NULL DEFAULT 'paragraph',
      heading_level INTEGER,
      heading TEXT,
      char_length INTEGER NOT NULL,
      estimated_tokens INTEGER NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
    );

    -- 向量表 (存储为 JSON)
    CREATE TABLE IF NOT EXISTS kb_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id TEXT NOT NULL UNIQUE,
      document_id INTEGER NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_vector BLOB NOT NULL,
      dimensions INTEGER NOT NULL,
      tokens INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chunk_id) REFERENCES kb_chunks(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
    );

    -- 向量索引 (优化查询)
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON kb_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_document ON kb_embeddings(document_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_chunk ON kb_embeddings(chunk_id);
  `);
}

/**
 * 存储文档并分块
 */
export async function indexDocument(
  name: string,
  content: string,
  options: {
    sourceType?: string;
    sourceUrl?: string;
    metadata?: Record<string, unknown>;
    chunkConfig?: ChunkConfig;
  } = {}
): Promise<{ documentId: number; chunkCount: number }> {
  ensureSearchSchema();
  const db = getDb();

  const { sourceType = "text", sourceUrl, metadata, chunkConfig } = options;
  
  // 1. 创建文档记录
  const docResult = db
    .prepare(
      `INSERT INTO kb_documents (name, source_type, source_url, metadata)
     VALUES (?, ?, ?, ?)`
    )
    .run(
      name,
      sourceType,
      sourceUrl || null,
      metadata ? JSON.stringify(metadata) : null
    );

  const documentId = Number(docResult.lastInsertRowid);

  // 2. 分块
  const chunks = chunkText(content, documentId, chunkConfig);

  if (chunks.length === 0) {
    return { documentId, chunkCount: 0 };
  }

  // 3. 批量存储 chunks 和 embeddings
  const insertChunk = db.prepare(`
    INSERT INTO kb_chunks (id, document_id, content, chunk_index, chunk_type, 
      heading_level, heading, char_length, estimated_tokens, start_offset, end_offset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const chunk of chunks) {
      insertChunk.run(
        chunk.id,
        documentId,
        chunk.content,
        chunk.metadata.chunkIndex,
        chunk.metadata.chunkType,
        chunk.metadata.headingLevel || null,
        chunk.metadata.heading || null,
        chunk.metadata.charLength,
        chunk.metadata.estimatedTokens,
        chunk.metadata.startOffset,
        chunk.metadata.endOffset
      );
    }
  })();

  // 4. 生成 embeddings
  await generateEmbeddings(documentId, chunks.map(c => c.content));

  return { documentId, chunkCount: chunks.length };
}

/**
 * 为文档生成 embeddings
 */
export async function generateEmbeddings(
  documentId: number,
  texts: string[]
): Promise<void> {
  if (texts.length === 0) return;

  const db = getDb();
  ensureSearchSchema();

  try {
    const result = await embedTexts(texts);

    const insertEmbedding = db.prepare(`
      INSERT OR REPLACE INTO kb_embeddings 
        (chunk_id, document_id, embedding_model, embedding_vector, dimensions, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (let i = 0; i < result.embeddings.length; i++) {
        const embedding = result.embeddings[i];
        const chunkId = `doc-${documentId}-chunk-${i}`;
        
        // 将向量转换为 Buffer (存储为 BLOB)
        const vectorBuffer = Buffer.from(new Float64Array(embedding).buffer);
        
        insertEmbedding.run(
          chunkId,
          documentId,
          result.modelId,
          vectorBuffer,
          embedding.length,
          result.totalTokens ? Math.ceil(result.totalTokens / result.embeddings.length) : null
        );
      }
    })();
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    throw error;
  }
}

/**
 * 搜索知识库
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  ensureSearchSchema();
  const db = getDb();

  const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

  // 1. 获取查询向量
  let queryEmbedding: number[];
  try {
    const result = await embedTexts([query]);
    queryEmbedding = result.embeddings[0];
  } catch (error) {
    console.error("Failed to embed query:", error);
    return {
      results: [],
      query,
      totalCandidates: 0,
      rerankEnabled: false,
      provider: "error",
    };
  }

  // 2. 获取所有 chunks 的 embeddings
  let query_sql = `
    SELECT e.chunk_id, e.embedding_vector, e.dimensions, e.document_id,
           c.content, c.chunk_index, c.chunk_type, c.heading_level, c.heading,
           c.char_length, c.estimated_tokens, d.name as document_name
    FROM kb_embeddings e
    JOIN kb_chunks c ON e.chunk_id = c.id
    JOIN kb_documents d ON e.document_id = d.id
  `;

  const params: (number | number[])[] = [];
  
  if (opts.documentId) {
    query_sql += " WHERE e.document_id = ?";
    params.push(opts.documentId);
  } else if (opts.documentIds && opts.documentIds.length > 0) {
    query_sql += ` WHERE e.document_id IN (${opts.documentIds.map(() => "?").join(",")})`;
    params.push(opts.documentIds);
  }

  const rows = db.prepare(query_sql).all(...params) as Array<{
    chunk_id: string;
    embedding_vector: Buffer;
    dimensions: number;
    document_id: number;
    content: string;
    chunk_index: number;
    chunk_type: string;
    heading_level: number | null;
    heading: string | null;
    char_length: number;
    estimated_tokens: number;
    document_name: string;
  }>;

  // 3. 计算相似度
  const candidates: Array<{
    chunk: Chunk;
    score: number;
    documentId: number;
    documentName: string;
  }> = [];

  for (const row of rows) {
    // 从 Buffer 还原向量
    const embedding = new Float64Array(row.embedding_vector);
    const vector = Array.from(embedding);

    if (vector.length !== queryEmbedding.length) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, vector);

    if (score >= opts.threshold) {
      candidates.push({
        chunk: {
          id: row.chunk_id,
          documentId: row.document_id,
          content: row.content,
          metadata: {
            documentId: row.document_id,
            chunkIndex: row.chunk_index,
            chunkType: row.chunk_type as Chunk["metadata"]["chunkType"],
            headingLevel: row.heading_level || undefined,
            heading: row.heading || undefined,
            charLength: row.char_length,
            estimatedTokens: row.estimated_tokens,
            startOffset: 0,
            endOffset: 0,
          },
        },
        score,
        documentId: row.document_id,
        documentName: row.document_name,
      });
    }
  }

  // 4. 排序并取 topK
  candidates.sort((a, b) => b.score - a.score);

  // 5. 可能的 Rerank
  let finalResults = candidates.slice(0, opts.topK * 2); // 多取一些用于 rerank

  if (opts.enableRerank && isRerankAvailable() && candidates.length > 0) {
    try {
      const rerankResults = await rerank(
        query,
        finalResults.map(r => ({
          id: r.chunk.id,
          text: r.chunk.content,
          score: r.score,
        })),
        opts.topK
      );

      // 按 rerank 结果重新排序
      finalResults = rerankResults.results.map(r => {
        const original = finalResults.find(c => c.chunk.id === r.id);
        return original
          ? { ...original, score: r.score }
          : {
              chunk: {
                id: r.id,
                documentId: 0,
                content: r.text,
                metadata: {
                  documentId: 0,
                  chunkIndex: 0,
                  chunkType: "paragraph" as const,
                  charLength: r.text.length,
                  estimatedTokens: Math.ceil(r.text.length / 4),
                  startOffset: 0,
                  endOffset: 0,
                },
              },
              score: r.score,
              documentId: 0,
              documentName: "",
            };
      });
    } catch (error) {
      console.warn("Rerank failed, using cosine results:", error);
    }
  } else {
    finalResults = candidates.slice(0, opts.topK);
  }

  return {
    results: finalResults,
    query,
    totalCandidates: candidates.length,
    rerankEnabled: opts.enableRerank && isRerankAvailable(),
    provider: "sqlite-cosine",
  };
}

/**
 * 删除文档及其 chunks 和 embeddings
 */
export function deleteDocument(documentId: number): void {
  const db = getDb();
  
  // CASCADE 会自动删除相关的 chunks 和 embeddings
  db.prepare("DELETE FROM kb_documents WHERE id = ?").run(documentId);
}

/**
 * 列出所有文档
 */
export function listDocuments(): Array<{
  id: number;
  name: string;
  sourceType: string;
  sourceUrl: string | null;
  chunkCount: number;
  createdAt: string;
}> {
  ensureSearchSchema();
  const db = getDb();

  const rows = db.prepare(`
    SELECT d.id, d.name, d.source_type, d.source_url, d.created_at,
           COUNT(c.id) as chunk_count
    FROM kb_documents d
    LEFT JOIN kb_chunks c ON d.id = c.document_id
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `).all() as Array<{
    id: number;
    name: string;
    source_type: string;
    source_url: string | null;
    created_at: string;
    chunk_count: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  }));
}

/**
 * 获取文档统计信息
 */
export function getDocumentStats(): {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
} {
  ensureSearchSchema();
  const db = getDb();

  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM kb_documents) as total_documents,
      (SELECT COUNT(*) FROM kb_chunks) as total_chunks,
      (SELECT COUNT(*) FROM kb_embeddings) as total_embeddings
  `).get() as {
    total_documents: number;
    total_chunks: number;
    total_embeddings: number;
  };

  return {
    totalDocuments: stats.total_documents,
    totalChunks: stats.total_chunks,
    totalEmbeddings: stats.total_embeddings,
  };
}
