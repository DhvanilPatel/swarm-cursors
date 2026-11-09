export interface SwarmProgress {
  completed: number;
  total: number;
  progress: number;
  workers: number;
}

export interface SwarmCompletion {
  completed: number;
  total: number;
  duration: number;
}

export interface SwarmReady {
  itemCount: number;
  taskCount: number;
}

export interface SwarmWarning {
  code:
    | "MEDIA_CAPTURE_FAILED"
    | "MEDIA_CAPTURE_INVALID"
    | "VIDEO_PLAY_BLOCKED"
    | "AUDIO_UNAVAILABLE"
    | "AUDIO_RESUME_FAILED"
    | "AUDIO_CLOSE_FAILED"
    | "FONT_LOAD_FAILED";
  error: unknown;
}

export interface SwarmEventMap {
  ready: SwarmReady;
  start: Record<string, never>;
  pause: Record<string, never>;
  resume: Record<string, never>;
  progress: SwarmProgress;
  complete: SwarmCompletion;
  stop: { completed: number; total: number };
  error: Error;
  warning: SwarmWarning;
}

export type SwarmEventName = keyof SwarmEventMap;
export type SwarmListener<T extends SwarmEventName> = (event: SwarmEventMap[T]) => void;
