/**
 * RAG (Retrieval-Augmented Generation) Core
 * 
 * 提供 RAG 功能的核心实现:
 * - 检索增强生成
 * - 上下文组装
 * - 引用追踪
 */

import { searchKnowledgeBase, type SearchResult } from "./search";

export interface RAGConfig {
  /** 返回的上下文 chunk 数量 */
  topK?: number;
  /** 相似度阈值 */
  threshold?: number;
  /** 是否启用 Rerank */
  enableRerank?: boolean;
  /** 最大上下文 token 数 (估算) */
  maxContextTokens?: number;
  /** 是否返回引用信息 */
  includeCitations?: boolean;
}

export interface RAGContext {
  query: string;
  chunks: SearchResult[];
  contextText: string;
  citations: RAGCitation[];
  metadata: {
    totalChunksFound: number;
    chunksUsed: number;
    estimatedTokens: number;
    rerankEnabled: boolean;
    provider: string;
  };
}

export interface RAGCitation {
  chunkId: string;
  documentName: string;
  documentId: number;
  score: number;
  excerpt: string;
}

const DEFAULT_CONFIG: Required<RAGConfig> = {
  topK: 5,
  threshold: 0.5,
  enableRerank: true,
  maxContextTokens: 4000,
  includeCitations: true,
};

/**
 * 执行 RAG 检索
 */
export async function retrieveContext(
  query: string,
  config: RAGConfig = {}
): Promise<RAGContext> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  // 1. 搜索知识库
  const searchResponse = await searchKnowledgeBase(query, {
    topK: opts.topK,
    threshold: opts.threshold,
    enableRerank: opts.enableRerank,
  });

  // 2. 组装上下文
  const { contextText, citations, chunksUsed } = assembleContext(
    searchResponse.results,
    opts.maxContextTokens,
    opts.includeCitations
  );

  return {
    query,
    chunks: searchResponse.results.slice(0, chunksUsed),
    contextText,
    citations,
    metadata: {
      totalChunksFound: searchResponse.results.length,
      chunksUsed,
      estimatedTokens: Math.ceil(contextText.length / 4),
      rerankEnabled: searchResponse.rerankEnabled,
      provider: searchResponse.provider,
    },
  };
}

/**
 * 组装检索到的上下文
 */
function assembleContext(
  results: SearchResult[],
  maxTokens: number,
  includeCitations: boolean
): {
  contextText: string;
  citations: RAGCitation[];
  chunksUsed: number;
} {
  const contextParts: string[] = [];
  const citations: RAGCitation[] = [];
  let currentTokens = 0;
  let chunksUsed = 0;

  for (const result of results) {
    const chunkTokens = result.chunk.metadata.estimatedTokens;

    // 检查是否超过最大 token
    if (currentTokens + chunkTokens > maxTokens) {
      break;
    }

    chunksUsed++;

    // 构建上下文片段
    const header = result.chunk.metadata.heading
      ? `## ${result.chunk.metadata.heading}\n\n`
      : `[文档: ${result.documentName || "未知"}]\n\n`;

    const excerpt = result.chunk.content.length > 300
      ? result.chunk.content.slice(0, 300) + "..."
      : result.chunk.content;

    contextParts.push(
      `[Chunk ${result.chunk.metadata.chunkIndex + 1}]\n${header}${excerpt}`
    );

    // 添加引用
    if (includeCitations) {
      citations.push({
        chunkId: result.chunk.id,
        documentName: result.documentName || "未知文档",
        documentId: result.documentId,
        score: result.score,
        excerpt: excerpt.slice(0, 150),
      });
    }

    currentTokens += chunkTokens;
  }

  const contextText = contextParts.join("\n\n---\n\n");

  return { contextText, citations, chunksUsed };
}

/**
 * 构建 RAG Prompt
 * 将检索到的上下文注入到 prompt 中
 */
export function buildRAGPrompt(
  originalPrompt: string,
  context: RAGContext,
  options: {
    /** 系统提示前缀 */
    systemPrefix?: string;
    /** 用户提示前缀 */
    userPrefix?: string;
    /** 是否包含引用说明 */
    includeCitationNote?: boolean;
  } = {}
): { system: string; user: string } {
  const { 
    systemPrefix = "你是一个智能助手。",
    userPrefix = "",
    includeCitationNote = true 
  } = options;

  // 构建系统提示
  const systemContext = `你拥有以下知识库上下文来回答问题。如果上下文中没有相关信息，请如实说明不知道，不要编造信息。

【知识库上下文】
${context.contextText}

【使用指南】
- 优先使用上述上下文中的信息回答问题
- 如果上下文中的信息不足以完整回答，可以结合你的知识补充
- 保持回答简洁、有条理`;

  const system = `${systemPrefix}\n\n${systemContext}`;

  // 构建用户提示
  let user = originalPrompt;

  if (userPrefix) {
    user = `${userPrefix}\n\n${originalPrompt}`;
  }

  // 添加引用说明
  if (includeCitationNote && context.citations.length > 0) {
    const citationNote = `\n\n【参考来源】\n${context.citations
      .map((c, i) => `[${i + 1}] ${c.documentName} (相关度: ${(c.score * 100).toFixed(1)}%)`)
      .join("\n")}`;
    
    user += citationNote;
  }

  return { system, user };
}

/**
 * 格式化引用为 Markdown
 */
export function formatCitationsAsMarkdown(citations: RAGCitation[]): string {
  if (citations.length === 0) {
    return "";
  }

  const citationLines = citations.map((c, i) => {
    const excerpt = c.excerpt.length > 100
      ? c.excerpt.slice(0, 100) + "..."
      : c.excerpt;

    return `${i + 1}. **${escapeMarkdown(c.documentName)}** (相关度: ${(c.score * 100).toFixed(1)}%)\n   > ${escapeMarkdown(excerpt)}`;
  });

  return `## 参考来源\n\n${citationLines.join("\n\n")}`;
}

/**
 * 转义 Markdown 特殊字符
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/#/g, "\\#");
}

/**
 * 检查知识库是否有数据
 */
export async function hasKnowledgeData(): Promise<boolean> {
  const { getDocumentStats } = await import("./search");
  const stats = getDocumentStats();
  return stats.totalDocuments > 0 && stats.totalChunks > 0;
}
