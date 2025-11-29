export interface Point {
  x: number;
  y: number;
}

export type AppleType = 'normal' | 'double' | 'invincible';

export interface Apple {
  x: number;
  y: number;
  type: AppleType;
}

export interface Rock {
  id: number;
  x: number;
  y: number;
  radius: number;
  spawnedAt: number;
  vertices: Point[]; // For drawing irregular shapes
}

export interface GameState {
  score: number;
  isGameOver: boolean;
  isPlaying: boolean;
  highScore: number;
  isInvincible: boolean; // UI state for visual feedback
}

// MediaPipe Global Types
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}