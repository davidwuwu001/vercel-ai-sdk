/**
 * Voice Client - Web Speech API Wrapper
 *
 * Provides unified interface for speech recognition (STT) and speech synthesis (TTS).
 * Falls back to server-side APIs when Web Speech API is unavailable.
 */

// Web Speech API types (not included in standard TypeScript lib)
interface SpeechRecognitionEvent extends Event {
  results: Array<{
    length: number;
    item(index: number): { transcript: string; confidence: number };
    [index: number]: { transcript: string; confidence: number };
    isFinal: boolean;
  }>;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Extend Window interface with Web Speech API
declare global {
  interface Window {
    SpeechRecognition: unknown;
    webkitSpeechRecognition: unknown;
  }
}

export type VoiceRecognitionState = "idle" | "listening" | "processing";

export interface VoiceClientOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

const DEFAULT_OPTIONS: VoiceClientOptions = {
  continuous: false,
  interimResults: true,
  lang: "zh-CN",
};

export class VoiceClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any;
  private synth: SpeechSynthesis | null = null;
  private options: VoiceClientOptions;
  private isListening = false;

  constructor(options: VoiceClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (typeof window !== "undefined") {
      this.synth = window.speechSynthesis;
      this.initRecognition();
    }
  }

  private initRecognition(): void {
    if (typeof window === "undefined") return;
    // Cast through unknown for Web Speech API which is not in standard types
    const win = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("Speech Recognition API not supported in this browser");
      return;
    }

    this.recognition = SpeechRecognitionAPI as typeof window.SpeechRecognition;
    this.recognition.continuous = this.options.continuous ?? false;
    this.recognition.interimResults = this.options.interimResults ?? true;
    this.recognition.lang = this.options.lang ?? "zh-CN";
    this.recognition.maxAlternatives = 1;
  }

  private ensureRecognition(): unknown {
    if (!this.recognition) {
      throw new Error(
        "Speech Recognition not supported. Please use Chrome or Edge browser."
      );
    }
    return this.recognition;
  }

  /**
   * Start voice recognition
   */
  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    if (this.isListening) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = this.ensureRecognition() as any;

    // Web Speech API handlers
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript, true);
      } else if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, string> = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone found. Please check your device.",
        "not-allowed": "Microphone access denied. Please allow microphone permissions.",
        "network": "Network error. Please check your connection.",
        "aborted": "Speech recognition was stopped.",
        "failed": "Speech recognition failed. Please try again.",
      };
      const message = errorMap[event.error] || `Error: ${event.error}`;
      onError?.(message);
      this.isListening = false;
    };

    recognition.onend = () => {
      this.isListening = false;
    };

    recognition.onstart = () => {
      this.isListening = true;
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      onError?.("Failed to start speech recognition");
    }
  }

  /**
   * Stop voice recognition
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      this.isListening = false;
    }
  }

  /**
   * Check if currently listening
   */
  getListeningState(): boolean {
    return this.isListening;
  }

  /**
   * Get available synthesis voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const voices = this.synth.getVoices();
    if (voices.length > 0) return voices;

    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const voiceList = this.synth!.getVoices();
      if (voiceList.length > 0) {
        resolve(voiceList);
      } else {
        this.synth!.onvoiceschanged = () => {
          resolve(this.synth!.getVoices());
        };
      }
    }) as unknown as SpeechSynthesisVoice[];
  }

  /**
   * Get voices synchronously (may be empty on first call)
   */
  getVoicesSync(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? [];
  }

  /**
   * Speak text using TTS
   */
  speak(
    text: string,
    voiceName?: string,
    lang?: string,
    rate = 1.0,
    pitch = 1.0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || this.options.lang || "zh-CN";
      utterance.rate = rate;
      utterance.pitch = pitch;

      if (voiceName) {
        const voices = this.synth?.getVoices() ?? [];
        const selectedVoice = voices.find(
          (v) =>
            v.name.includes(voiceName) ||
            v.voiceURI.includes(voiceName) ||
            v.lang.startsWith(voiceName)
        );
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);

      this.synth?.speak(utterance);
    });
  }

  /**
   * Stop current speech
   */
  stopSpeaking(): void {
    this.synth?.cancel();
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  /**
   * Pause speech (if supported)
   */
  pause(): void {
    if (this.synth?.speaking) {
      this.synth.pause();
    }
  }

  /**
   * Resume speech (if supported)
   */
  resume(): void {
    if (this.synth?.paused) {
      this.synth.resume();
    }
  }

  /**
   * Update language setting
   */
  setLanguage(lang: string): void {
    this.options.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Check browser support
   */
  static isRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!((window as { SpeechRecognition?: unknown }).SpeechRecognition || (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  }

  static isSynthesisSupported(): boolean {
    return "speechSynthesis" in window;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
    this.recognition = null;
  }
}

/**
 * Server-side TTS fallback
 */
export async function serverTextToSpeech(
  text: string,
  voice?: string,
  model?: string
): Promise<ArrayBuffer> {
  const response = await fetch("/api/media/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, model }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "TTS request failed");
  }

  return response.arrayBuffer();
}

/**
 * Server-side STT fallback
 */
export async function serverSpeechToText(
  audioBlob: Blob,
  language?: string,
  model?: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("language", language || "zh-CN");
  if (model) formData.append("model", model);

  const response = await fetch("/api/media/stt", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "STT request failed");
  }

  const result = await response.json();
  return result.text;
}
