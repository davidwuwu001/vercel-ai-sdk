/**
 * Image Understanding Module
 * 
 * Provides unified interface for image understanding/analyzing across multiple providers:
 * - Volcengine Ark Vision (Doubao-vision)
 * - Alibaba Bailian Vision (Qwen-VL)
 * - OpenAI GPT-4V
 * - Anthropic Claude Vision
 * - Mock (for testing)
 * 
 * Note: For chat-integrated vision (sending images in messages), use the
 * vision capability check in @/lib/ai/model.ts instead. This module is for
 * dedicated image analysis tasks (e.g., "analyze this image and extract text").
 */

import type { ImageAnalysisResult, ImageUnderstandingOptions } from "./types";

/**
 * 从 URL 或 Base64 获取图片类型
 */
function getImageMimeType(source: string): string {
  if (source.startsWith("data:")) {
    const match = source.match(/data:([^;]+);/);
    return match ? match[1] : "image/png";
  }
  // 从 URL 推断
  if (source.includes(".jpg") || source.includes(".jpeg")) {
    return "image/jpeg";
  }
  if (source.includes(".gif")) {
    return "image/gif";
  }
  if (source.includes(".webp")) {
    return "image/webp";
  }
  return "image/png";
}

/**
 * 将图片 URL 转换为 Base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get("content-type") || "image/png";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    throw new Error(`Failed to fetch image from ${url}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * 生成 Mock 分析结果
 */
async function analyzeWithMock(
  _imageSource: string
): Promise<ImageAnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    description: "This is a mock analysis result. In production, the actual AI model would analyze the image content.",
    objects: ["mock object 1", "mock object 2"],
    labels: ["mock-label-1", "mock-label-2"],
    provider: "mock",
    model: "mock-vision",
    createdAt: new Date().toISOString(),
  };
}

/**
 * 使用 Volcengine Ark Vision API 分析图片
 * 
 * 支持的模型:
 * - doubao-vision-pro
 * - doubao-vision-lite
 */
async function analyzeWithArk(
  imageSource: string,
  options: ImageUnderstandingOptions,
  apiKey: string,
  baseUrl: string = "https://ark.cn-beijing.volces.com/api/v3"
): Promise<ImageAnalysisResult> {
  try {
    // 获取图片数据
    let imageData = imageSource;
    if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      imageData = await fetchImageAsBase64(imageSource);
    }

    // 转换图片格式
    const imageBase64 = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;
    const mimeType = getImageMimeType(imageData);

    const modelId = options.model || "doubao-vision-pro";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt || "请详细描述这张图片的内容。",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        description: "",
        objects: [],
        labels: [],
        provider: "ark",
        model: modelId,
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const content = data.choices?.[0]?.message?.content || "";

    return {
      description: content,
      objects: extractObjects(content),
      labels: extractLabels(content),
      provider: "ark",
      model: modelId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      description: "",
      objects: [],
      labels: [],
      provider: "ark",
      model: options.model || "doubao-vision-pro",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 使用阿里云百炼 (Qwen-VL) 分析图片
 */
async function analyzeWithBailian(
  imageSource: string,
  options: ImageUnderstandingOptions,
  apiKey: string,
  baseUrl: string = "https://dashscope.aliyuncs.com/compatible-mode/v1"
): Promise<ImageAnalysisResult> {
  try {
    let imageData = imageSource;
    if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      imageData = await fetchImageAsBase64(imageSource);
    }

    const imageBase64 = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;
    const mimeType = getImageMimeType(imageData);

    const modelId = options.model || "qwen-vl-plus";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt || "请详细描述这张图片的内容。",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        description: "",
        objects: [],
        labels: [],
        provider: "bailian",
        model: modelId,
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const content = data.choices?.[0]?.message?.content || "";

    return {
      description: content,
      objects: extractObjects(content),
      labels: extractLabels(content),
      provider: "bailian",
      model: modelId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      description: "",
      objects: [],
      labels: [],
      provider: "bailian",
      model: options.model || "qwen-vl-plus",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 使用 OpenAI GPT-4V 分析图片
 */
async function analyzeWithOpenAI(
  imageSource: string,
  options: ImageUnderstandingOptions,
  apiKey: string
): Promise<ImageAnalysisResult> {
  try {
    let imageData = imageSource;
    if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      imageData = await fetchImageAsBase64(imageSource);
    }

    const imageBase64 = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;
    const mimeType = getImageMimeType(imageData);

    const modelId = options.model || "gpt-4o";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt || "Please describe this image in detail.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: options.detailLevel || "high",
                },
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        description: "",
        objects: [],
        labels: [],
        provider: "openai",
        model: modelId,
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const content = data.choices?.[0]?.message?.content || "";

    return {
      description: content,
      objects: extractObjects(content),
      labels: extractLabels(content),
      provider: "openai",
      model: modelId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      description: "",
      objects: [],
      labels: [],
      provider: "openai",
      model: options.model || "gpt-4o",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 使用 Anthropic Claude Vision 分析图片
 */
async function analyzeWithAnthropic(
  imageSource: string,
  options: ImageUnderstandingOptions,
  apiKey: string
): Promise<ImageAnalysisResult> {
  try {
    let imageData = imageSource;
    if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      imageData = await fetchImageAsBase64(imageSource);
    }

    const imageBase64 = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;
    const mimeType = getImageMimeType(imageData);

    // Anthropic 使用不同的 API 格式
    const modelId = options.model || "claude-3-5-sonnet-20241022";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: options.maxTokens || 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt || "Please describe this image in detail.",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        description: "",
        objects: [],
        labels: [],
        provider: "anthropic",
        model: modelId,
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const content = data.content?.find((c) => c.type === "text")?.text || "";

    return {
      description: content,
      objects: extractObjects(content),
      labels: extractLabels(content),
      provider: "anthropic",
      model: modelId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      description: "",
      objects: [],
      labels: [],
      provider: "anthropic",
      model: options.model || "claude-3-5-sonnet-20241022",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 从文本中提取可能的物体列表（简单启发式方法）
 */
function extractObjects(text: string): string[] {
  // 简单的启发式提取，识别常见的物体描述模式
  const patterns = [
    /(?<=有|看到|图中|画面中|照片中|图片中)([^。，,]+?)(?:的|是|和|，|\.)/g,
    /(?:包含|包括)([^。，,]+?)(?:的|是|和|，|\.)/g,
  ];

  const objects: string[] = [];
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const obj = match[1]?.trim();
      if (obj && obj.length > 1 && obj.length < 50) {
        objects.push(obj);
      }
    }
  }

  // 去重并限制数量
  return [...new Set(objects)].slice(0, 10);
}

/**
 * 从文本中提取标签（简单启发式方法）
 */
function extractLabels(text: string): string[] {
  // 识别常见的标签模式
  const commonLabels: string[] = [];
  const lowerText = text.toLowerCase();

  const labelKeywords = [
    { keyword: "person", label: "人物" },
    { keyword: "people", label: "人物" },
    { keyword: "animal", label: "动物" },
    { keyword: "dog", label: "狗" },
    { keyword: "cat", label: "猫" },
    { keyword: "car", label: "汽车" },
    { keyword: "building", label: "建筑" },
    { keyword: "tree", label: "树木" },
    { keyword: "sky", label: "天空" },
    { keyword: "water", label: "水" },
    { keyword: "mountain", label: "山" },
    { keyword: "food", label: "食物" },
    { keyword: "text", label: "文字" },
    { keyword: "indoor", label: "室内" },
    { keyword: "outdoor", label: "室外" },
  ];

  for (const { keyword, label } of labelKeywords) {
    if (lowerText.includes(keyword)) {
      commonLabels.push(label);
    }
  }

  return [...new Set(commonLabels)];
}

/**
 * 主入口：分析图片
 * 
 * @param options - 图片分析选项，包含图片源和提示词
 * @returns 图片分析结果
 */
export async function analyzeImage(
  options: ImageUnderstandingOptions
): Promise<ImageAnalysisResult> {
  // Mock 模式用于测试
  if (
    process.env.USE_MOCK_MEDIA === "true" ||
    !options.imageSource ||
    options.provider === "mock"
  ) {
    return analyzeWithMock(options.imageSource || "");
  }

  const provider = options.provider || "ark";

  switch (provider) {
    case "ark": {
      const apiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
      if (!apiKey) {
        console.warn("[image-understanding] ARK_API_KEY not set, using mock");
        return analyzeWithMock(options.imageSource);
      }
      return analyzeWithArk(
        options.imageSource,
        options,
        apiKey,
        options.baseUrl
      );
    }

    case "bailian": {
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        console.warn("[image-understanding] DASHSCOPE_API_KEY not set, using mock");
        return analyzeWithMock(options.imageSource);
      }
      return analyzeWithBailian(
        options.imageSource,
        options,
        apiKey,
        options.baseUrl
      );
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("[image-understanding] OPENAI_API_KEY not set, using mock");
        return analyzeWithMock(options.imageSource);
      }
      return analyzeWithOpenAI(options.imageSource, options, apiKey);
    }

    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn("[image-understanding] ANTHROPIC_API_KEY not set, using mock");
        return analyzeWithMock(options.imageSource);
      }
      return analyzeWithAnthropic(options.imageSource, options, apiKey);
    }

    default:
      console.warn(`[image-understanding] Unknown provider: ${provider}, using mock`);
      return analyzeWithMock(options.imageSource);
  }
}

/**
 * 快速检测图片中是否包含文字
 */
export async function detectTextInImage(
  imageSource: string,
  options?: { provider?: "ark" | "bailian" | "openai" | "anthropic" | "mock" }
): Promise<{ hasText: boolean; text?: string }> {
  const result = await analyzeImage({
    imageSource,
    provider: options?.provider,
    prompt:
      "请仔细检查图片中是否包含文字内容。如果有文字，请完整提取所有文字；如果没有文字，请明确说明。",
  });

  const hasText = result.error === undefined && 
    (result.description.toLowerCase().includes("文字") ||
     result.description.toLowerCase().includes("text") ||
     !result.description.includes("没有") && result.description.length > 10);

  return {
    hasText,
    text: hasText ? result.description : undefined,
  };
}

/**
 * 获取支持的视觉模型列表
 */
export function getSupportedVisionModels(): Array<{
  provider: string;
  modelId: string;
  name: string;
  description: string;
}> {
  return [
    // Volcengine Ark
    {
      provider: "ark",
      modelId: "doubao-vision-pro",
      name: "Doubao Vision Pro",
      description: "字节豆包视觉模型，支持高质量图片理解",
    },
    {
      provider: "ark",
      modelId: "doubao-vision-lite",
      name: "Doubao Vision Lite",
      description: "轻量级视觉模型，适合快速分析",
    },
    // Alibaba Bailian
    {
      provider: "bailian",
      modelId: "qwen-vl-plus",
      name: "Qwen VL Plus",
      description: "通义千问视觉增强版，支持复杂图片理解",
    },
    {
      provider: "bailian",
      modelId: "qwen-vl-max",
      name: "Qwen VL Max",
      description: "通义千问视觉旗舰版，业界领先的理解能力",
    },
    // OpenAI
    {
      provider: "openai",
      modelId: "gpt-4o",
      name: "GPT-4o",
      description: "OpenAI 最新多模态模型",
    },
    {
      provider: "openai",
      modelId: "gpt-4-turbo",
      name: "GPT-4 Turbo Vision",
      description: "GPT-4 视觉版本，适合图片理解",
    },
    // Anthropic
    {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Anthropic 最新的多模态模型",
    },
    {
      provider: "anthropic",
      modelId: "claude-3-opus-20240229",
      name: "Claude 3 Opus Vision",
      description: "Claude 3 Opus 视觉版本",
    },
  ];
}

export { analyzeWithMock, analyzeWithArk, analyzeWithBailian, analyzeWithOpenAI, analyzeWithAnthropic };
