/**
 * Document Chunking Utilities
 * 
 * 支持多种分块策略:
 * - 按标题/段落分块 (heading-aware)
 * - 按固定 token 长度分块 (overlap 支持)
 * - 智能分块 (结合上述策略)
 */

export interface Chunk {
  id: string;
  documentId: number;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  /** 来源文档 ID */
  documentId: number;
  /** 分块索引 */
  chunkIndex: number;
  /** 分块类型: heading, paragraph, fixed */
  chunkType: "heading" | "paragraph" | "fixed";
  /** 标题层级 (如果有) */
  headingLevel?: number;
  /** 所属标题 (如果有) */
  heading?: string;
  /** 字符长度 */
  charLength: number;
  /** 估算 token 数 */
  estimatedTokens: number;
  /** 起始位置 */
  startOffset: number;
  /** 结束位置 */
  endOffset: number;
}

export interface ChunkConfig {
  /** 最大 token 数，默认 512 */
  maxTokens?: number;
  /** 重叠 token 数，默认 50 */
  overlapTokens?: number;
  /** 最小 chunk 长度 (字符) */
  minChunkLength?: number;
  /** 分块策略 */
  strategy?: "heading" | "paragraph" | "fixed" | "smart";
  /** 是否保留标题信息 */
  includeHeadings?: boolean;
}

/** 默认配置 */
const DEFAULT_CONFIG: Required<ChunkConfig> = {
  maxTokens: 512,
  overlapTokens: 50,
  minChunkLength: 50,
  strategy: "smart",
  includeHeadings: true,
};

/**
 * 估算 token 数
 * 简单估算: 中文约 1.5-2 字符/token，英文约 4 字符/token
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 中文 1.5 字符/token，英文 4 字符/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 生成唯一 chunk ID
 */
function generateChunkId(documentId: number, index: number): string {
  return `doc-${documentId}-chunk-${index}`;
}

/**
 * 按段落分块
 */
function chunkByParagraphs(
  text: string,
  documentId: number,
  config: Required<ChunkConfig>
): Chunk[] {
  const chunks: Chunk[] = [];
  
  // 按换行符分割段落
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;
  let globalOffset = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);

    // 如果单个段落就超过限制，按句子继续拆分
    if (paraTokens > config.maxTokens) {
      // 先保存当前 chunk
      if (currentChunk.length > 0) {
        chunks.push(createChunk(documentId, chunkIndex, currentChunk, "paragraph", globalOffset));
        chunkIndex++;
      }
      
      // 按句子拆分
      const sentences = splitIntoSentences(paragraph);
      currentChunk = "";
      currentTokens = 0;

      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        if (currentTokens + sentTokens > config.maxTokens && currentChunk.length > 0) {
          chunks.push(createChunk(documentId, chunkIndex, currentChunk, "fixed", globalOffset));
          chunkIndex++;
          globalOffset += currentChunk.length;
          
          // 添加重叠
          currentChunk = getOverlap(currentChunk, config.overlapTokens);
          currentTokens = estimateTokens(currentChunk);
        }
        currentChunk += (currentChunk ? "\n" : "") + sentence;
        currentTokens += sentTokens;
      }
    } else if (currentTokens + paraTokens > config.maxTokens) {
      // 当前 chunk 已满，保存并开始新的
      if (currentChunk.length > config.minChunkLength) {
        chunks.push(createChunk(documentId, chunkIndex, currentChunk, "paragraph", globalOffset));
        chunkIndex++;
        globalOffset += currentChunk.length;
        
        // 添加重叠
        currentChunk = getOverlap(currentChunk, config.overlapTokens);
        currentTokens = estimateTokens(currentChunk);
      }
      currentChunk = paragraph;
      currentTokens = paraTokens;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      currentTokens += paraTokens;
    }
  }

  // 保存最后一个 chunk
  if (currentChunk.length > config.minChunkLength) {
    chunks.push(createChunk(documentId, chunkIndex, currentChunk, "paragraph", globalOffset));
  }

  return chunks;
}

/**
 * 按标题分块 (保留文档结构)
 */
function chunkByHeadings(
  text: string,
  documentId: number,
  config: Required<ChunkConfig>
): Chunk[] {
  const chunks: Chunk[] = [];
  
  // 解析标题和内容
  const sections = parseSections(text);
  let chunkIndex = 0;
  let globalOffset = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (sectionTokens <= config.maxTokens) {
      // 整个 section 作为一个 chunk
      chunks.push(createChunk(
        documentId,
        chunkIndex,
        section.content,
        section.headingLevel ? "heading" : "paragraph",
        globalOffset,
        section.headingLevel,
        section.heading
      ));
      chunkIndex++;
      globalOffset += section.content.length;
    } else {
      // Section 太大，需要进一步拆分
      if (section.heading) {
        // 添加带标题的前缀
        const headingPrefix = section.heading + "\n\n";
        const remainingTokens = config.maxTokens - estimateTokens(headingPrefix);
        
        // 按段落继续拆分
        const subChunks = chunkByParagraphs(
          headingPrefix + section.content,
          documentId,
          { ...config, maxTokens: remainingTokens + estimateTokens(headingPrefix) }
        );
        
        for (const subChunk of subChunks) {
          subChunk.metadata.chunkIndex = chunkIndex;
          subChunk.metadata.heading = section.heading;
          subChunk.metadata.headingLevel = section.headingLevel;
          chunks.push(subChunk);
          chunkIndex++;
        }
        globalOffset += section.content.length;
      } else {
        // 没有标题，直接按段落拆分
        const subChunks = chunkByParagraphs(section.content, documentId, config);
        for (const subChunk of subChunks) {
          subChunk.metadata.chunkIndex = chunkIndex;
          chunks.push(subChunk);
          chunkIndex++;
        }
        globalOffset += section.content.length;
      }
    }
  }

  return chunks;
}

/**
 * 固定长度分块 (不考虑语义)
 */
function chunkByFixedLength(
  text: string,
  documentId: number,
  config: Required<ChunkConfig>
): Chunk[] {
  const chunks: Chunk[] = [];
  const maxChars = Math.floor(config.maxTokens * 4); // 估算字符数
  
  let currentPos = 0;
  let chunkIndex = 0;
  let globalOffset = 0;

  while (currentPos < text.length) {
    // 计算当前 chunk 的边界
    const chunkEnd = Math.min(currentPos + maxChars, text.length);
    
    // 尽量在句子边界结束
    const actualEnd = findSentenceBoundary(text, chunkEnd);
    
    const chunkText = text.slice(currentPos, actualEnd).trim();
    
    if (chunkText.length >= config.minChunkLength) {
      chunks.push(createChunk(documentId, chunkIndex, chunkText, "fixed", globalOffset));
      chunkIndex++;
      globalOffset = actualEnd;
    }

    // 移动到下一个位置 (包含重叠)
    currentPos = actualEnd - Math.floor(config.overlapTokens * 4);
    if (currentPos <= globalOffset) {
      currentPos = actualEnd;
    }
  }

  return chunks;
}

/**
 * 智能分块 (结合标题和段落)
 */
function chunkSmart(
  text: string,
  documentId: number,
  config: Required<ChunkConfig>
): Chunk[] {
  // 先尝试按标题分块
  const hasHeadings = /#{1,6}\s/.test(text);
  
  if (hasHeadings) {
    return chunkByHeadings(text, documentId, config);
  }
  
  // 没有标题，按段落分块
  return chunkByParagraphs(text, documentId, config);
}

/**
 * 主接口: 将文本分块
 */
export function chunkText(
  text: string,
  documentId: number,
  config: ChunkConfig = {}
): Chunk[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 预处理: 移除多余空白
  const cleanText = text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  switch (fullConfig.strategy) {
    case "heading":
      return chunkByHeadings(cleanText, documentId, fullConfig);
    case "paragraph":
      return chunkByParagraphs(cleanText, documentId, fullConfig);
    case "fixed":
      return chunkByFixedLength(cleanText, documentId, fullConfig);
    case "smart":
    default:
      return chunkSmart(cleanText, documentId, fullConfig);
  }
}

/**
 * 创建 Chunk 对象
 */
function createChunk(
  documentId: number,
  index: number,
  content: string,
  chunkType: ChunkMetadata["chunkType"],
  startOffset: number,
  headingLevel?: number,
  heading?: string
): Chunk {
  return {
    id: generateChunkId(documentId, index),
    documentId,
    content,
    metadata: {
      documentId,
      chunkIndex: index,
      chunkType,
      headingLevel,
      heading,
      charLength: content.length,
      estimatedTokens: estimateTokens(content),
      startOffset,
      endOffset: startOffset + content.length,
    },
  };
}

/**
 * 按句子拆分
 */
function splitIntoSentences(text: string): string[] {
  // 匹配中英文句子边界
  const sentences: string[] = [];
  let current = "";
  
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    
    // 检测句子结束
    if (
      (text[i] === "。" || text[i] === "！" || text[i] === "？") || // 中文
      (text[i] === "." && (text[i + 1] === " " || i + 1 >= text.length)) || // 英文句号
      (text[i] === "!" && text[i + 1] === " ") ||
      (text[i] === "?" && text[i + 1] === " ")
    ) {
      sentences.push(current.trim());
      current = "";
    }
  }
  
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  return sentences;
}

/**
 * 找到最近的句子边界
 */
function findSentenceBoundary(text: string, position: number): number {
  const searchStart = Math.max(0, position - 100);
  const searchText = text.slice(searchStart, position + 50);
  
  // 找最后一个句子结束符
  const sentenceEnders = /[。！？.!?]\s/g;
  let lastMatch = searchStart;
  let match;
  
  while ((match = sentenceEnders.exec(searchText)) !== null) {
    lastMatch = searchStart + match.index + 1;
  }
  
  // 如果找到句子边界，返回它；否则返回原始位置
  return lastMatch > searchStart ? lastMatch : position;
}

/**
 * 获取重叠文本
 */
function getOverlap(text: string, overlapTokens: number): string {
  const charsToKeep = overlapTokens * 4; // 估算
  const overlapText = text.slice(-charsToKeep);
  
  // 尽量从句子边界开始
  const boundary = findSentenceBoundary(overlapText, overlapText.length);
  return overlapText.slice(boundary - overlapText.length);
}

/**
 * 解析文档结构 (标题和内容)
 */
interface Section {
  heading?: string;
  headingLevel?: number;
  content: string;
}

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split("\n");
  
  let currentSection: Section = { content: "" };
  let currentHeading: string | undefined;
  let currentHeadingLevel: number | undefined;

  for (const line of lines) {
    // 检测标题行
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // 保存当前 section
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }
      
      currentHeading = headingMatch[2];
      currentHeadingLevel = headingMatch[1].length;
      currentSection = {
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
        content: "",
      };
    } else {
      currentSection.content += (currentSection.content ? "\n" : "") + line;
    }
  }

  // 保存最后一个 section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}
