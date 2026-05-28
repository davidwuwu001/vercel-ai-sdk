/**
 * Media Module Types
 * 
 * Common types for image generation, speech-to-text, and text-to-speech.
 */

export type MediaProvider = "openai" | "ark" | "bailian" | "anthropic" | "mock";

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024" | "512x512" | "256x256";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  n?: number;
  provider?: MediaProvider;
}

export interface ImageGenerationResult {
  id: string;
  url?: string;
  base64?: string;
  revisedPrompt?: string;
  provider: MediaProvider;
  model: string;
  createdAt: string;
  error?: string;
}

export interface SpeechToTextOptions {
  file: Buffer;
  fileName: string;
  mimeType: string;
  language?: string;
  model?: string;
  provider?: MediaProvider;
}

export interface SpeechToTextResult {
  id: string;
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  provider: MediaProvider;
  model: string;
  createdAt: string;
  error?: string;
}

export interface TextToSpeechOptions {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  format?: "mp3" | "opus" | "aac" | "flac";
  provider?: MediaProvider;
}

export interface TextToSpeechResult {
  id: string;
  audioBase64?: string;
  audioUrl?: string;
  duration?: number;
  provider: MediaProvider;
  model: string;
  voice: string;
  createdAt: string;
  error?: string;
}

export interface MediaGenerationMetadata {
  id: string;
  type: "image" | "stt" | "tts";
  provider: MediaProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  createdAt: string;
  error?: string;
}

export interface MediaProviderConfig {
  provider: MediaProvider;
  baseUrl?: string;
  apiKeyEnv?: string;
  model?: string;
  voice?: string;
}

/**
 * 图片理解/分析选项
 */
export interface ImageUnderstandingOptions {
  /** 图片源 (URL 或 Base64) */
  imageSource: string;
  /** 提示词，指导 AI 如何分析图片 */
  prompt?: string;
  /** 使用的模型 */
  model?: string;
  /** Provider */
  provider?: MediaProvider;
  /** 基础 URL（可选） */
  baseUrl?: string;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 图片细节级别 (OpenAI) */
  detailLevel?: "low" | "high" | "auto";
}

/**
 * 图片分析结果
 */
export interface ImageAnalysisResult {
  /** 详细描述 */
  description: string;
  /** 检测到的物体列表 */
  objects: string[];
  /** 标签列表 */
  labels: string[];
  /** Provider */
  provider: MediaProvider;
  /** 使用的模型 */
  model: string;
  /** 创建时间 */
  createdAt: string;
  /** 错误信息 */
  error?: string;
}
