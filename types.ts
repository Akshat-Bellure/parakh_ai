export type Tab = 'scan' | 'chat' | 'lab';
export type ScanState = 'idle' | 'scanning' | 'result';
export type VerdictType = 'safe' | 'warning' | 'danger';

export interface ScanComponent {
  name: string;
  status: 'safe' | 'caution' | 'danger';
  reason: string;
}

export interface AnalysisResult {
  category: string;
  title: string;
  subtitle: string;
  score_final: number;
  scores: {
    safety: number;
    purity: number;
    efficacy: number;
  };
  verdict_type: VerdictType;
  verdict_text: string;
  scientific_context: string;
  components: ScanComponent[];
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface LabTest {
  id: string;
  name: string;
  icon: string;
}

// Added types for Gemini Dashboard components
export enum AppMode {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  LIVE = 'live'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
