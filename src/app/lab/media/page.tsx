"use client";

import { ArrowLeft, Image, Mic, Volume2, Eye, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { ImageGenerationResult, SpeechToTextResult, TextToSpeechResult, ImageAnalysisResult } from "@/lib/media/types";

type TabType = "image" | "stt" | "tts" | "vision";

const VOICES = [
  { id: "alloy", name: "Alloy", description: "中性通用" },
  { id: "echo", name: "Echo", description: "男声" },
  { id: "fable", name: "Fable", description: "英式发音" },
  { id: "onyx", name: "Onyx", description: "深沉男声" },
  { id: "nova", name: "Nova", description: "活泼女声" },
  { id: "shimmer", name: "Shimmer", description: "柔和女声" },
];

const IMAGE_SIZES = [
  { id: "1024x1024", name: "1024×1024", description: "方形" },
  { id: "1024x1792", name: "1024×1792", description: "竖版" },
  { id: "1792x1024", name: "1792×1024", description: "横版" },
  { id: "512x512", name: "512×512", description: "小方形" },
  { id: "256x256", name: "256×256", description: "图标尺寸" },
];

const PROVIDERS = [
  { id: "mock", name: "Mock", description: "测试模式" },
  { id: "ark", name: "Ark (Volcengine)", description: "火山引擎" },
  { id: "openai", name: "OpenAI", description: "OpenAI API" },
  { id: "bailian", name: "Bailian", description: "阿里云百炼" },
  { id: "anthropic", name: "Anthropic", description: "Claude Vision" },
];

const VISION_PROVIDERS = [
  { id: "mock", name: "Mock", description: "测试模式" },
  { id: "ark", name: "Ark (Doubao Vision)", description: "火山引擎" },
  { id: "bailian", name: "Bailian (Qwen-VL)", description: "阿里云百炼" },
  { id: "openai", name: "OpenAI (GPT-4V)", description: "OpenAI API" },
  { id: "anthropic", name: "Anthropic (Claude)", description: "Claude Vision" },
];

export default function MediaLabPage() {
  const [activeTab, setActiveTab] = useState<TabType>("image");
  
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageProvider, setImageProvider] = useState("mock");
  const [imageResult, setImageResult] = useState<ImageGenerationResult | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioLanguage, setAudioLanguage] = useState("zh");
  const [sttResult, setSttResult] = useState<SpeechToTextResult | null>(null);
  const [sttLoading, setSttLoading] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  
  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("alloy");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsResult, setTtsResult] = useState<TextToSpeechResult | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Image Understanding State
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionPrompt, setVisionPrompt] = useState("请详细描述这张图片的内容。");
  const [visionProvider, setVisionProvider] = useState("mock");
  const [visionResult, setVisionResult] = useState<ImageAnalysisResult | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);
  
  const generateImage = useCallback(async () => {
    if (!imagePrompt.trim()) return;
    
    setImageLoading(true);
    setImageError(null);
    setImageResult(null);
    
    try {
      const response = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          size: imageSize,
          provider: imageProvider,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        setImageError(data.error?.message || "Generation failed");
        return;
      }
      
      setImageResult(data.result);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Network error");
    } finally {
      setImageLoading(false);
    }
  }, [imagePrompt, imageSize, imageProvider]);
  
  const transcribeAudio = useCallback(async () => {
    if (!audioFile) return;
    
    setSttLoading(true);
    setSttError(null);
    setSttResult(null);
    
    try {
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("language", audioLanguage);
      formData.append("provider", "mock");
      
      const response = await fetch("/api/media/stt", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        setSttError(data.error?.message || "Transcription failed");
        return;
      }
      
      setSttResult(data.result);
    } catch (err) {
      setSttError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSttLoading(false);
    }
  }, [audioFile, audioLanguage]);
  
  const synthesizeSpeech = useCallback(async () => {
    if (!ttsText.trim()) return;

    setTtsLoading(true);
    setTtsError(null);
    setTtsResult(null);

    try {
      const response = await fetch("/api/media/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ttsText,
          voice: ttsVoice,
          speed: ttsSpeed,
          format: "mp3",
          provider: "mock",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setTtsError(data.error?.message || "Synthesis failed");
        return;
      }

      setTtsResult(data.result);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTtsLoading(false);
    }
  }, [ttsText, ttsVoice, ttsSpeed]);

  const analyzeImage = useCallback(async () => {
    if (!visionImage) return;

    setVisionLoading(true);
    setVisionError(null);
    setVisionResult(null);

    try {
      const response = await fetch("/api/media/image-understanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageSource: visionImage,
          prompt: visionPrompt,
          provider: visionProvider,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setVisionError(data.error?.message || data.message || "Analysis failed");
        return;
      }

      setVisionResult({
        description: data.description,
        objects: data.objects || [],
        labels: data.labels || [],
        provider: data.metadata?.provider || visionProvider,
        model: data.metadata?.model || "unknown",
        createdAt: data.metadata?.createdAt || new Date().toISOString(),
      });
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setVisionLoading(false);
    }
  }, [visionImage, visionPrompt, visionProvider]);

  const handleVisionFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setVisionImage(base64);
    };
    reader.readAsDataURL(file);
  }, []);
  
  const renderImageResult = () => {
    if (imageLoading) {
      return (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="app-accent size-6 animate-spin" />
          <span className="app-muted">Generating image...</span>
        </div>
      );
    }
    
    if (imageError) {
      return (
        <div className="flex items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
          <AlertCircle className="size-5 shrink-0 text-rose-400" />
          <div>
            <p className="app-title font-semibold">Generation Failed</p>
            <p className="app-muted mt-1 text-sm">{imageError}</p>
          </div>
        </div>
      );
    }
    
    if (imageResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="app-accent size-5" />
            <span className="app-title font-semibold">Generation Complete</span>
          </div>
          
          <div className="overflow-hidden rounded-lg border bg-black/20">
            {imageResult.base64 ? (
              <img
                src={`data:image/png;base64,${imageResult.base64}`}
                alt="Generated"
                className="mx-auto max-h-96 object-contain"
              />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="app-muted text-sm">No image preview available (mock mode)</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Provider</span>
              <p className="app-title mt-1">{imageResult.provider}</p>
            </div>
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Model</span>
              <p className="app-title mt-1">{imageResult.model}</p>
            </div>
          </div>
          
          {imageResult.revisedPrompt && (
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Revised Prompt</span>
              <p className="app-muted mt-1 text-sm">{imageResult.revisedPrompt}</p>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="app-muted text-sm">Enter a prompt and click Generate</p>
      </div>
    );
  };
  
  const renderSttResult = () => {
    if (sttLoading) {
      return (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="app-accent size-6 animate-spin" />
          <span className="app-muted">Transcribing audio...</span>
        </div>
      );
    }
    
    if (sttError) {
      return (
        <div className="flex items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
          <AlertCircle className="size-5 shrink-0 text-rose-400" />
          <div>
            <p className="app-title font-semibold">Transcription Failed</p>
            <p className="app-muted mt-1 text-sm">{sttError}</p>
          </div>
        </div>
      );
    }
    
    if (sttResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="app-accent size-5" />
            <span className="app-title font-semibold">Transcription Complete</span>
          </div>
          
          <div className="rounded-lg border bg-black/20 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {sttResult.text}
            </pre>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Provider</span>
              <p className="app-title mt-1">{sttResult.provider}</p>
            </div>
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Model</span>
              <p className="app-title mt-1">{sttResult.model}</p>
            </div>
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Language</span>
              <p className="app-title mt-1">{sttResult.language || "auto"}</p>
            </div>
          </div>
          
          {sttResult.segments && sttResult.segments.length > 0 && (
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Segments</span>
              <div className="mt-2 space-y-1">
                {sttResult.segments.slice(0, 5).map((seg, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="app-subtle shrink-0 font-mono">
                      [{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s]
                    </span>
                    <span className="app-muted">{seg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="app-muted text-sm">Upload an audio file and click Transcribe</p>
      </div>
    );
  };
  
  const renderTtsResult = () => {
    if (ttsLoading) {
      return (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="app-accent size-6 animate-spin" />
          <span className="app-muted">Synthesizing speech...</span>
        </div>
      );
    }
    
    if (ttsError) {
      return (
        <div className="flex items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
          <AlertCircle className="size-5 shrink-0 text-rose-400" />
          <div>
            <p className="app-title font-semibold">Synthesis Failed</p>
            <p className="app-muted mt-1 text-sm">{ttsError}</p>
          </div>
        </div>
      );
    }
    
    if (ttsResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="app-accent size-5" />
            <span className="app-title font-semibold">Synthesis Complete</span>
          </div>
          
          {ttsResult.audioBase64 ? (
            <div className="rounded-lg border bg-black/20 p-4">
              <audio
                controls
                className="w-full"
                src={`data:audio/mp3;base64,${ttsResult.audioBase64}`}
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
              <p className="app-muted text-sm">Audio ready (mock mode - no actual audio)</p>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Provider</span>
              <p className="app-title mt-1">{ttsResult.provider}</p>
            </div>
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Voice</span>
              <p className="app-title mt-1">{ttsResult.voice}</p>
            </div>
            <div>
              <span className="app-subtle font-mono text-xs uppercase">Duration</span>
              <p className="app-title mt-1">{ttsResult.duration || "~"}s</p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="app-muted text-sm">Enter text and click Synthesize</p>
      </div>
    );
  };
  
  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                AI Agent Lab
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                媒体实验室
              </h1>
              <p className="app-muted mt-4 max-w-3xl text-sm leading-7 md:text-base">
                图像生成、语音转文字 (STT) 和文字转语音 (TTS) 实验。可以在 Mock
                模式下测试 UI，无需真实 API 密钥。
              </p>
            </div>
            <div className="app-chip-active border px-4 py-3 font-mono text-xs">
              <p className="app-subtle uppercase tracking-[0.18em]">Supported</p>
              <p className="app-accent mt-1">Image / STT / TTS</p>
            </div>
          </div>
        </header>
        
        <div className="mt-5">
          <div className="app-panel border">
            <div className="flex border-b">
              <button
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-sm transition ${
                  activeTab === "image"
                    ? "app-accent border-b-2 bg-cyan-400/5"
                    : "app-muted hover:bg-cyan-400/5"
                }`}
                onClick={() => setActiveTab("image")}
                type="button"
              >
                <Image className="size-4" />
                图像生成
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-sm transition ${
                  activeTab === "stt"
                    ? "app-accent border-b-2 bg-cyan-400/5"
                    : "app-muted hover:bg-cyan-400/5"
                }`}
                onClick={() => setActiveTab("stt")}
                type="button"
              >
                <Mic className="size-4" />
                语音转文字
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-sm transition ${
                  activeTab === "tts"
                    ? "app-accent border-b-2 bg-cyan-400/5"
                    : "app-muted hover:bg-cyan-400/5"
                }`}
                onClick={() => setActiveTab("tts")}
                type="button"
              >
                <Volume2 className="size-4" />
                文字转语音
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-sm transition ${
                  activeTab === "vision"
                    ? "app-accent border-b-2 bg-cyan-400/5"
                    : "app-muted hover:bg-cyan-400/5"
                }`}
                onClick={() => setActiveTab("vision")}
                type="button"
              >
                <Eye className="size-4" />
                图片理解
              </button>
            </div>
            
            <div className="p-5">
              {activeTab === "image" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Provider
                      </label>
                      <select
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value)}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.description})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Prompt
                      </label>
                      <textarea
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        rows={4}
                        placeholder="A beautiful sunset over the ocean..."
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Size
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {IMAGE_SIZES.map((s) => (
                          <button
                            key={s.id}
                            className={`app-button-accent border px-3 py-1.5 font-mono text-xs ${
                              imageSize === s.id ? "" : "opacity-50"
                            }`}
                            onClick={() => setImageSize(s.id)}
                            type="button"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      className="app-button-hot flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!imagePrompt.trim() || imageLoading}
                      onClick={generateImage}
                      type="button"
                    >
                      {imageLoading && <Loader2 className="size-4 animate-spin" />}
                      Generate Image
                    </button>
                  </div>
                  
                  <div>{renderImageResult()}</div>
                </div>
              )}
              
              {activeTab === "stt" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Provider
                      </label>
                      <select
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value)}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.description})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Language
                      </label>
                      <select
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        value={audioLanguage}
                        onChange={(e) => setAudioLanguage(e.target.value)}
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="zh">Chinese (中文)</option>
                        <option value="en">English</option>
                        <option value="ja">Japanese (日本語)</option>
                        <option value="ko">Korean (한국어)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Audio File
                      </label>
                      <div
                        className="cursor-pointer rounded-lg border-2 border-dashed border-cyan-400/30 bg-cyan-400/5 p-8 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/10"
                        onClick={() => audioInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                      >
                        <input
                          ref={audioInputRef}
                          accept="audio/*"
                          className="hidden"
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setAudioFile(file);
                          }}
                        />
                        <Mic className="app-accent mx-auto mb-3 size-10" />
                        <p className="app-title font-semibold">
                          {audioFile ? audioFile.name : "Click to upload audio"}
                        </p>
                        <p className="app-muted mt-2 text-sm">
                          WAV, MP3, M4A, OGG supported
                        </p>
                      </div>
                    </div>
                    
                    <button
                      className="app-button-hot flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!audioFile || sttLoading}
                      onClick={transcribeAudio}
                      type="button"
                    >
                      {sttLoading && <Loader2 className="size-4 animate-spin" />}
                      Transcribe
                    </button>
                  </div>
                  
                  <div>{renderSttResult()}</div>
                </div>
              )}
              
              {activeTab === "tts" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Provider
                      </label>
                      <select
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value)}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.description})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Text
                      </label>
                      <textarea
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        rows={4}
                        placeholder="Hello, this is a text-to-speech test..."
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Voice
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {VOICES.map((v) => (
                          <button
                            key={v.id}
                            className={`app-button-accent border px-3 py-2 text-center font-mono text-xs ${
                              ttsVoice === v.id ? "" : "opacity-50"
                            }`}
                            onClick={() => setTtsVoice(v.id)}
                            type="button"
                          >
                            <span className="block font-semibold">{v.name}</span>
                            <span className="app-subtle">{v.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Speed: {ttsSpeed.toFixed(1)}x
                      </label>
                      <input
                        className="w-full"
                        max={2}
                        min={0.5}
                        step={0.1}
                        type="range"
                        value={ttsSpeed}
                        onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                      />
                    </div>
                    
                    <button
                      className="app-button-hot flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!ttsText.trim() || ttsLoading}
                      onClick={synthesizeSpeech}
                      type="button"
                    >
                      {ttsLoading && <Loader2 className="size-4 animate-spin" />}
                      Synthesize
                    </button>
                  </div>
                  
                  <div>{renderTtsResult()}</div>
                </div>
              )}

              {activeTab === "vision" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        Provider
                      </label>
                      <select
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        value={visionProvider}
                        onChange={(e) => setVisionProvider(e.target.value)}
                      >
                        {VISION_PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.description})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        图片
                      </label>
                      <div
                        className="cursor-pointer rounded-lg border-2 border-dashed border-cyan-400/30 bg-cyan-400/5 p-8 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/10"
                        onClick={() => visionInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                      >
                        <input
                          ref={visionInputRef}
                          accept="image/*"
                          className="hidden"
                          type="file"
                          onChange={handleVisionFileChange}
                        />
                        {visionImage ? (
                          <img
                            src={visionImage}
                            alt="Preview"
                            className="mx-auto max-h-48 rounded-lg object-contain"
                          />
                        ) : (
                          <>
                            <Eye className="app-accent mx-auto mb-3 size-10" />
                            <p className="app-title font-semibold">点击上传图片</p>
                            <p className="app-muted mt-2 text-sm">
                              支持 JPG, PNG, GIF, WebP 格式
                            </p>
                          </>
                        )}
                      </div>
                      {visionImage && (
                        <button
                          className="app-button-accent mt-2 w-full border px-3 py-2 font-mono text-xs opacity-60 hover:opacity-100"
                          onClick={() => setVisionImage(null)}
                          type="button"
                        >
                          清除图片
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                        分析提示词
                      </label>
                      <textarea
                        className="app-input w-full border px-3 py-2 font-mono text-sm"
                        rows={3}
                        placeholder="请详细描述这张图片的内容..."
                        value={visionPrompt}
                        onChange={(e) => setVisionPrompt(e.target.value)}
                      />
                    </div>

                    <button
                      className="app-button-hot flex w-full items-center justify-center gap-2 border px-4 py-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!visionImage || visionLoading}
                      onClick={analyzeImage}
                      type="button"
                    >
                      {visionLoading && <Loader2 className="size-4 animate-spin" />}
                      分析图片
                    </button>
                  </div>

                  <div>
                    {visionLoading && (
                      <div className="flex h-full items-center justify-center gap-3">
                        <Loader2 className="app-accent size-8 animate-spin" />
                        <span className="app-muted">正在分析图片...</span>
                      </div>
                    )}

                    {visionError && (
                      <div className="flex h-full items-start gap-3 border border-rose-300/40 bg-rose-950/40 p-4">
                        <AlertCircle className="size-5 shrink-0 text-rose-400" />
                        <div>
                          <p className="app-title font-semibold">分析失败</p>
                          <p className="app-muted mt-1 text-sm">{visionError}</p>
                        </div>
                      </div>
                    )}

                    {visionResult && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="app-accent size-5" />
                          <span className="app-title font-semibold">分析完成</span>
                        </div>

                        {visionImage && (
                          <div className="overflow-hidden rounded-lg border bg-black/20">
                            <img
                              src={visionImage}
                              alt="Analyzed"
                              className="mx-auto max-h-48 object-contain"
                            />
                          </div>
                        )}

                        <div className="rounded-lg border bg-black/20 p-4">
                          <span className="app-subtle mb-2 block font-mono text-xs uppercase tracking-wider">
                            分析结果
                          </span>
                          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                            {visionResult.description}
                          </pre>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="app-subtle font-mono text-xs uppercase">Provider</span>
                            <p className="app-title mt-1">{visionResult.provider}</p>
                          </div>
                          <div>
                            <span className="app-subtle font-mono text-xs uppercase">Model</span>
                            <p className="app-title mt-1">{visionResult.model}</p>
                          </div>
                        </div>

                        {visionResult.labels && visionResult.labels.length > 0 && (
                          <div>
                            <span className="app-subtle font-mono text-xs uppercase">标签</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {visionResult.labels.map((label, i) => (
                                <span
                                  key={i}
                                  className="app-chip-active border px-2 py-1 font-mono text-xs"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {visionResult.objects && visionResult.objects.length > 0 && (
                          <div>
                            <span className="app-subtle font-mono text-xs uppercase">检测到的物体</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {visionResult.objects.map((obj, i) => (
                                <span
                                  key={i}
                                  className="app-chip-accent border px-2 py-1 font-mono text-xs opacity-80"
                                >
                                  {obj}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!visionLoading && !visionError && !visionResult && (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
                        <div className="text-center">
                          <Eye className="app-accent mx-auto mb-3 size-10 opacity-50" />
                          <p className="app-muted text-sm">上传图片并点击分析</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
