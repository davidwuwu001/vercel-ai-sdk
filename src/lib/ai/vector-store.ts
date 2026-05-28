/**
 * Simple Vector Store
 * 
 * 简化版向量存储实现，提供更简单的 API 接口
 * 基于 SQLite + Cosine Similarity
 * 
 * 使用现有的 embedding-provider 和 search 模块
 */

import { embedText, cosineSimilarity } from "../knowledge/embedding-provider";

export interface VectorEntry {
  id: string;
  text: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorStoreConfig {
  /** 返回结果数量 */
  topK?: number;
  /** 相似度阈值 */
  threshold?: number;
  /** 向量维度 */
  dimensions?: number;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// 内存中的简单向量存储（用于快速原型）
// 生产环境应使用专门的向量数据库
const inMemoryStore: VectorEntry[] = [];

/**
 * 添加向量到存储
 */
export async function addVector(
  id: string,
  text: string,
  metadata?: Record<string, unknown>
): Promise<VectorEntry> {
  const result = await embedText(text);
  const entry: VectorEntry = {
    id,
    text,
    vector: result.embedding,
    metadata,
  };
  
  // 检查是否已存在
  const existingIndex = inMemoryStore.findIndex(e => e.id === id);
  if (existingIndex >= 0) {
    inMemoryStore[existingIndex] = entry;
  } else {
    inMemoryStore.push(entry);
  }
  
  return entry;
}

/**
 * 批量添加向量
 */
export async function addVectors(
  entries: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
): Promise<VectorEntry[]> {
  const results: VectorEntry[] = [];
  
  for (const entry of entries) {
    const result = await addVector(entry.id, entry.text, entry.metadata);
    results.push(result);
  }
  
  return results;
}

/**
 * 搜索相似向量
 */
export async function searchVectors(
  query: string,
  options: VectorStoreConfig = {}
): Promise<SearchResult[]> {
  const { topK = 5, threshold = 0.5 } = options;
  
  if (inMemoryStore.length === 0) {
    return [];
  }
  
  // 获取查询向量
  const queryResult = await embedText(query);
  const queryVector = queryResult.embedding;
  
  // 计算相似度
  const scored: Array<SearchResult & { score: number }> = [];
  
  for (const entry of inMemoryStore) {
    if (entry.vector.length !== queryVector.length) {
      continue;
    }
    
    const score = cosineSimilarity(queryVector, entry.vector);
    
    if (score >= threshold) {
      scored.push({
        id: entry.id,
        text: entry.text,
        score,
        metadata: entry.metadata,
      });
    }
  }
  
  // 排序并返回 topK
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK);
}

/**
 * 删除向量
 */
export function deleteVector(id: string): boolean {
  const index = inMemoryStore.findIndex(e => e.id === id);
  if (index >= 0) {
    inMemoryStore.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * 清空存储
 */
export function clearStore(): void {
  inMemoryStore.length = 0;
}

/**
 * 获取存储统计
 */
export function getStoreStats(): {
  totalVectors: number;
  dimensions: number;
} {
  return {
    totalVectors: inMemoryStore.length,
    dimensions: inMemoryStore.length > 0 ? inMemoryStore[0].vector.length : 0,
  };
}

/**
 * 列出所有向量
 */
export function listVectors(): Array<{
  id: string;
  text: string;
  vectorLength: number;
  metadata?: Record<string, unknown>;
}> {
  return inMemoryStore.map(e => ({
    id: e.id,
    text: e.text,
    vectorLength: e.vector.length,
    metadata: e.metadata,
  }));
}
