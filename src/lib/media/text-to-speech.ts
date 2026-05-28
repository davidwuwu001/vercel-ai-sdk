/**
 * Text-to-Speech Module
 * 
 * Provides unified interface for TTS across multiple providers:
 * - OpenAI TTS
 * - Volcengine Ark
 * - Alibaba Bailian
 * - Mock (for testing)
 */

import type { TextToSpeechOptions, TextToSpeechResult } from "./types";

function generateId(): string {
  return `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function synthesizeWithMock(
  options: TextToSpeechOptions
): Promise<TextToSpeechResult> {
  const id = generateId();
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return {
    id,
    audioBase64: undefined,
    audioUrl: undefined,
    duration: Math.floor(options.text.length / 10),
    provider: "mock",
    model: "mock-tts-model",
    voice: options.voice || "mock-voice",
    createdAt: new Date().toISOString(),
    error: undefined,
  };
}

async function synthesizeWithArk(
  options: TextToSpeechOptions,
  apiKey: string,
  baseUrl: string = "https://ark.cn-beijing.volces.com/api/coding/v3"
): Promise<TextToSpeechResult> {
  const id = generateId();
  
  try {
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "doubao-pro-32k",
        input: options.text,
        voice: options.voice || "default",
        response_format: options.format || "mp3",
        speed: options.speed || 1.0,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        provider: "ark",
        model: options.model || "doubao-pro-32k",
        voice: options.voice || "default",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    
    return {
      id,
      audioBase64,
      duration: Math.floor(options.text.length / 10),
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      voice: options.voice || "default",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      voice: options.voice || "default",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function synthesizeWithOpenAI(
  options: TextToSpeechOptions,
  apiKey: string
): Promise<TextToSpeechResult> {
  const id = generateId();
  
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "tts-1",
        input: options.text,
        voice: options.voice || "alloy",
        response_format: options.format || "mp3",
        speed: options.speed || 1.0,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        provider: "openai",
        model: options.model || "tts-1",
        voice: options.voice || "alloy",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    
    return {
      id,
      audioBase64,
      duration: Math.floor(options.text.length / 10),
      provider: "openai",
      model: options.model || "tts-1",
      voice: options.voice || "alloy",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      provider: "openai",
      model: options.model || "tts-1",
      voice: options.voice || "alloy",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function synthesizeSpeech(
  options: TextToSpeechOptions
): Promise<TextToSpeechResult> {
  if (process.env.USE_MOCK_MEDIA === "true" || !options.provider || options.provider === "mock") {
    return synthesizeWithMock(options);
  }
  
  const provider = options.provider || "ark";
  
  switch (provider) {
    case "ark": {
      const apiKey = process.env.ARK_API_KEY;
      if (!apiKey) {
        console.warn("[tts] ARK_API_KEY not set, using mock");
        return synthesizeWithMock(options);
      }
      return synthesizeWithArk(options, apiKey);
    }
    
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("[tts] OPENAI_API_KEY not set, using mock");
        return synthesizeWithMock(options);
      }
      return synthesizeWithOpenAI(options, apiKey);
    }
    
    case "bailian":
      console.warn("[tts] Bailian not yet implemented, using mock");
      return synthesizeWithMock(options);
    
    default:
      return synthesizeWithMock(options);
  }
}

export { synthesizeWithMock, synthesizeWithArk, synthesizeWithOpenAI };
