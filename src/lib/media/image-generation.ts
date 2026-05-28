/**
 * Image Generation Module
 * 
 * Provides unified interface for image generation across multiple providers:
 * - OpenAI DALL-E
 * - Volcengine Ark
 * - Alibaba Bailian
 * - Mock (for testing)
 */

import type { ImageGenerationOptions, ImageGenerationResult } from "./types";

function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function generateWithMock(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const id = generateId();
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    id,
    url: undefined,
    base64: undefined,
    revisedPrompt: options.prompt,
    provider: "mock",
    model: "mock-image-generator",
    createdAt: new Date().toISOString(),
    error: undefined,
  };
}

async function generateWithArk(
  options: ImageGenerationOptions,
  apiKey: string,
  baseUrl: string = "https://ark.cn-beijing.volces.com/api/coding/v3"
): Promise<ImageGenerationResult> {
  const id = generateId();
  
  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "doubao-pro-32k",
        prompt: options.prompt,
        size: options.size || "1024x1024",
        n: options.n || 1,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        provider: "ark",
        model: options.model || "doubao-pro-32k",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }> };
    
    return {
      id,
      url: data.data?.[0]?.url,
      base64: data.data?.[0]?.b64_json,
      revisedPrompt: data.data?.[0]?.revised_prompt,
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function generateWithOpenAI(
  options: ImageGenerationOptions,
  apiKey: string
): Promise<ImageGenerationResult> {
  const id = generateId();
  
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "dall-e-3",
        prompt: options.prompt,
        n: options.n || 1,
        size: options.size || "1024x1024",
        quality: options.quality || "standard",
        style: options.style || "vivid",
        response_format: "b64_json",
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        provider: "openai",
        model: options.model || "dall-e-3",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const data = await response.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
    
    return {
      id,
      base64: data.data?.[0]?.b64_json,
      revisedPrompt: data.data?.[0]?.revised_prompt,
      provider: "openai",
      model: options.model || "dall-e-3",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      provider: "openai",
      model: options.model || "dall-e-3",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  if (process.env.USE_MOCK_MEDIA === "true" || !options.provider || options.provider === "mock") {
    return generateWithMock(options);
  }
  
  const provider = options.provider || "ark";
  
  switch (provider) {
    case "ark": {
      const apiKey = process.env.ARK_API_KEY;
      if (!apiKey) {
        console.warn("[image-generation] ARK_API_KEY not set, using mock");
        return generateWithMock(options);
      }
      return generateWithArk(options, apiKey);
    }
    
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("[image-generation] OPENAI_API_KEY not set, using mock");
        return generateWithMock(options);
      }
      return generateWithOpenAI(options, apiKey);
    }
    
    case "bailian":
      console.warn("[image-generation] Bailian not yet implemented, using mock");
      return generateWithMock(options);
    
    default:
      return generateWithMock(options);
  }
}

export { generateWithMock, generateWithArk, generateWithOpenAI };
