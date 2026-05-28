/**
 * Speech-to-Text Module
 * 
 * Provides unified interface for STT across multiple providers:
 * - OpenAI Whisper
 * - Volcengine Ark
 * - Alibaba Bailian
 * - Mock (for testing)
 */

import type { SpeechToTextOptions, SpeechToTextResult } from "./types";

function generateId(): string {
  return `stt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function transcribeWithMock(
  options: SpeechToTextOptions
): Promise<SpeechToTextResult> {
  const id = generateId();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  return {
    id,
    text: `[Mock transcription for: ${options.fileName}]\n\nThis is a placeholder transcription. In a real implementation, this would contain the actual transcribed text from the audio file.`,
    language: options.language || "zh",
    duration: Math.floor(options.file.length / 1000),
    provider: "mock",
    model: "mock-stt-model",
    createdAt: new Date().toISOString(),
    segments: [
      { start: 0, end: 2.5, text: "[Mock transcription for: " + options.fileName + "]" },
      { start: 2.5, end: 5.0, text: "This is a placeholder transcription." },
      { start: 5.0, end: 8.0, text: "In a real implementation, this would contain the actual transcribed text." },
    ],
  };
}

async function transcribeWithArk(
  options: SpeechToTextOptions,
  apiKey: string,
  baseUrl: string = "https://ark.cn-beijing.volces.com/api/coding/v3"
): Promise<SpeechToTextResult> {
  const id = generateId();
  
  try {
    const formData = new FormData();
    // Convert Buffer to Uint8Array for Blob compatibility
    const bytes = options.file instanceof Buffer 
      ? new Uint8Array(options.file) 
      : new Uint8Array(options.file);
    formData.append("file", new Blob([bytes]), options.fileName);
    formData.append("model", options.model || "doubao-pro-32k");
    if (options.language) {
      formData.append("language", options.language);
    }
    
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        text: "",
        provider: "ark",
        model: options.model || "doubao-pro-32k",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const data = await response.json() as { text?: string; language?: string; duration?: number };
    
    return {
      id,
      text: data.text || "",
      language: data.language || options.language,
      duration: data.duration,
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      text: "",
      provider: "ark",
      model: options.model || "doubao-pro-32k",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function transcribeWithOpenAI(
  options: SpeechToTextOptions,
  apiKey: string
): Promise<SpeechToTextResult> {
  const id = generateId();
  
  try {
    const formData = new FormData();
    // Convert Buffer to Uint8Array for Blob compatibility
    const bytes = options.file instanceof Buffer 
      ? new Uint8Array(options.file) 
      : new Uint8Array(options.file);
    formData.append("file", new Blob([bytes]), options.fileName);
    formData.append("model", options.model || "whisper-1");
    if (options.language) {
      formData.append("language", options.language);
    }
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        id,
        text: "",
        provider: "openai",
        model: options.model || "whisper-1",
        createdAt: new Date().toISOString(),
        error: `API Error: ${response.status} - ${error}`,
      };
    }
    
    const data = await response.json() as { text?: string; language?: string; duration?: number };
    
    return {
      id,
      text: data.text || "",
      language: data.language || options.language,
      duration: data.duration,
      provider: "openai",
      model: options.model || "whisper-1",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      text: "",
      provider: "openai",
      model: options.model || "whisper-1",
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function transcribeAudio(
  options: SpeechToTextOptions
): Promise<SpeechToTextResult> {
  if (process.env.USE_MOCK_MEDIA === "true" || !options.provider || options.provider === "mock") {
    return transcribeWithMock(options);
  }
  
  const provider = options.provider || "ark";
  
  switch (provider) {
    case "ark": {
      const apiKey = process.env.ARK_API_KEY;
      if (!apiKey) {
        console.warn("[stt] ARK_API_KEY not set, using mock");
        return transcribeWithMock(options);
      }
      return transcribeWithArk(options, apiKey);
    }
    
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("[stt] OPENAI_API_KEY not set, using mock");
        return transcribeWithMock(options);
      }
      return transcribeWithOpenAI(options, apiKey);
    }
    
    case "bailian":
      console.warn("[stt] Bailian not yet implemented, using mock");
      return transcribeWithMock(options);
    
    default:
      return transcribeWithMock(options);
  }
}

export { transcribeWithMock, transcribeWithArk, transcribeWithOpenAI };
