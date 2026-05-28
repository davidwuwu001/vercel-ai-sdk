"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowLeft,
  Globe,
  Mic,
  Settings,
  Speaker,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { VoiceClient, type VoiceRecognitionState } from "@/lib/voice/client";
import { VoiceInputButton, VoiceWaveform } from "@/components/voice-input-button";

const LANGUAGES = [
  { code: "zh-CN", label: "中文 (普通话)" },
  { code: "zh-HK", label: "中文 (粤语)" },
  { code: "zh-TW", label: "中文 (台湾)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
];

const STATUS_TEXT: Record<VoiceRecognitionState, string> = {
  idle: "Ready",
  listening: "Listening...",
  processing: "Processing...",
};

const STATUS_COLOR: Record<VoiceRecognitionState, string> = {
  idle: "text-[var(--text-muted)]",
  listening: "text-[var(--hot)]",
  processing: "text-[var(--accent)]",
};

export default function VoiceLabPage() {
  const [state, setState] = useState<VoiceRecognitionState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState("zh-CN");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Initialize supported state directly to avoid synchronous setState in effect
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    return VoiceClient.isRecognitionSupported();
  });

  const clientRef = useRef<VoiceClient | null>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);
  const voicesLoadedRef = useRef(false);

  useEffect(() => {
    if (!supported) return;

    clientRef.current = new VoiceClient({ lang: language });

    const loadVoices = () => {
      if (clientRef.current && !voicesLoadedRef.current) {
        const v = clientRef.current.getVoicesSync();
        if (v.length > 0) {
          setVoices(v);
          const langPrefix = language.split("-")[0];
          const defaultVoice = v.find(
            (voice) => voice.lang.startsWith(langPrefix)
          );
          setSelectedVoice(defaultVoice?.name || v[0].name);
          voicesLoadedRef.current = true;
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      clientRef.current?.destroy();
    };
  }, [supported, language]);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscript((prev) => prev + text + " ");
        setInterimText("");
        setState("idle");
      } else {
        setInterimText(text);
      }
    },
    []
  );

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setState("idle");
    setTimeout(() => setError(null), 5000);
  }, []);

  const handleStartListening = () => {
    if (!clientRef.current) return;
    setState("listening");
    setError(null);
    clientRef.current.startListening(handleTranscript, handleError);
  };

  const handleStopListening = () => {
    clientRef.current?.stopListening();
    setState("idle");
  };

  const handleSpeakResponse = async () => {
    if (!clientRef.current) return;

    if (isSpeaking) {
      clientRef.current.stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      await clientRef.current.speak(transcript, selectedVoice, language);
    } catch {
      // TTS error handled silently
    }
    setIsSpeaking(false);
  };

  const handleClear = () => {
    setTranscript("");
    setInterimText("");
    setError(null);
  };

  const handleTestTTS = async () => {
    if (!clientRef.current) return;

    const testText = language.startsWith("zh")
      ? "你好，这是一段语音测试。"
      : "Hello, this is a voice test.";

    setIsSpeaking(true);
    try {
      await clientRef.current.speak(testText, selectedVoice, language);
    } catch {
      // TTS error handled silently
    }
    setIsSpeaking(false);
  };

  const filteredVoices = useMemo(
    () => voices.filter((v) => v.lang.startsWith(language.split("-")[0])),
    [voices, language]
  );

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    clientRef.current?.setLanguage(newLang);
    const defaultVoice = voices.find(
      (v) => v.lang.startsWith(newLang.split("-")[0])
    );
    if (defaultVoice) {
      setSelectedVoice(defaultVoice.name);
    }
  };

  if (!supported) {
    return (
      <main className="app-shell min-h-screen px-4 py-5 md:px-8">
        <div className="mx-auto max-w-2xl">
          <header className="app-panel border p-5 md:p-7">
            <Link
              className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
              href="/lab"
            >
              <ArrowLeft className="size-4" />
              Back to lab
            </Link>
            <h1 className="app-title mt-2 text-3xl font-semibold">Voice Lab</h1>
            <p className="app-muted mt-4">
              Speech recognition is not supported in this browser.
            </p>
            <p className="app-muted mt-2">
              Please use Chrome or Edge for the best experience.
            </p>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="app-panel border p-5 md:p-7">
          <Link
            className="app-accent mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
            href="/lab"
          >
            <ArrowLeft className="size-4" />
            Back to lab
          </Link>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="app-hot font-mono text-xs uppercase tracking-[0.28em]">
                Voice Interface
              </p>
              <h1 className="app-title mt-2 text-3xl font-semibold md:text-5xl">
                语音实验室
              </h1>
              <p className="app-muted mt-4 max-w-2xl text-sm leading-7">
                使用浏览器原生 Web Speech API 进行语音输入和语音合成。支持中文、英文等多语言。
              </p>
            </div>
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              className="app-button-accent inline-flex items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors"
            >
              <Settings className="size-4" />
              Settings
            </button>
          </div>
        </header>

        {showSettings && (
          <section className="app-card border p-4 mt-5">
            <h2 className="app-title text-sm font-semibold mb-4 flex items-center gap-2">
              <Settings className="size-4 text-[var(--accent)]" />
              Voice Settings
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="app-muted block text-xs uppercase tracking-[0.12em] mb-2">
                  <Globe className="size-3 inline mr-1" />
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="field-input w-full"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="app-muted block text-xs uppercase tracking-[0.12em] mb-2">
                  <Speaker className="size-3 inline mr-1" />
                  Voice
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="field-input w-full"
                >
                  {filteredVoices.length > 0 ? (
                    filteredVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No voices available</option>
                  )}
                </select>
              </div>
            </div>
            <button
              onClick={handleTestTTS}
              disabled={isSpeaking || voices.length === 0}
              className="app-button-accent mt-4 inline-flex items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
            >
              <Volume2 className="size-4" />
              Test Voice
            </button>
          </section>
        )}

        <section className="mt-5">
          <div className="app-panel border p-6 md:p-10">
            <div className="flex flex-col items-center gap-8">
              <div className="text-center">
                <div
                  className={`font-mono text-xs uppercase tracking-[0.2em] ${STATUS_COLOR[state]}`}
                >
                  {error ? (
                    <span className="text-red-400">{error}</span>
                  ) : (
                    STATUS_TEXT[state]
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <VoiceWaveform
                    isActive={state === "listening" || state === "processing"}
                    barCount={7}
                  />
                </div>
              </div>

              <VoiceInputButton
                onTranscript={(text) => {
                  setTranscript((prev) => prev + text);
                  setInterimText("");
                }}
                onError={handleError}
                language={language}
                size="xl"
              />

              <p className="app-muted text-sm text-center max-w-xs">
                {state === "idle"
                  ? "Tap the microphone to start speaking"
                  : state === "listening"
                  ? "Listening... Tap again to stop"
                  : "Processing your speech..."}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-4">
          <div className="app-card border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="app-title text-sm font-semibold flex items-center gap-2">
                <Mic className="size-4 text-[var(--accent)]" />
                Transcript
              </h2>
              {(transcript || interimText) && (
                <button
                  onClick={handleClear}
                  className="app-muted text-xs uppercase tracking-[0.1em] hover:text-[var(--accent)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="min-h-[80px]">
              <p className="app-muted text-sm leading-relaxed whitespace-pre-wrap">
                {transcript}
                {interimText && (
                  <span className="text-[var(--accent)] opacity-70 italic">
                    {interimText}
                  </span>
                )}
                {!transcript && !interimText && (
                  <span className="text-[var(--text-subtle)]">
                    Your speech will appear here...
                  </span>
                )}
              </p>
            </div>
          </div>

          {transcript && (
            <div className="app-card border p-4" ref={responseEndRef}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="app-title text-sm font-semibold flex items-center gap-2">
                  <Volume2 className="size-4 text-[var(--hot)]" />
                  AI Response
                </h2>
                <button
                  onClick={handleSpeakResponse}
                  disabled={!transcript}
                  className="app-button-hot inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors disabled:opacity-50"
                >
                  <Volume2 className="size-3" />
                  {isSpeaking ? "Stop" : "Speak"}
                </button>
              </div>
              <p className="app-muted text-sm leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="app-panel-soft border p-4">
            <h3 className="app-title text-sm font-semibold mb-3">Tips</h3>
            <ul className="app-muted text-xs space-y-2">
              <li>
                • Use Chrome or Edge for best speech recognition support
              </li>
              <li>
                • Allow microphone permissions when prompted
              </li>
              <li>
                • Select the matching language in settings for better accuracy
              </li>
              <li>
                • For longer speech, enable &quot;Continuous&quot; mode in settings
              </li>
              <li>
                • Voice selection depends on your system&apos;s installed voices
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
