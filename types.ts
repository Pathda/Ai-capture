
export interface Step {
  timestamp: number;
  description: string;
  screenshot?: string;
}

export type AppState = 'idle' | 'recording' | 'processing' | 'results' | 'error';