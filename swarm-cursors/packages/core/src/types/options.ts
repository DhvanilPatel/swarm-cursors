export type SwarmTarget = Element;

export interface CursorOptions {
  /** Initial and preferred number of agents. Default: 18. */
  count?: number;
  /** Lower bound while the swarm adapts to work and scrolling. Default: 8. */
  minCount?: number;
  /** Upper bound while the swarm adapts to work and scrolling. Default: 48. */
  maxCount?: number;
  /** Cursor SVG size in CSS pixels. Default: 16. */
  size?: number;
  /** CSS colors cycled between agents. */
  colors?: string[];
  /** Cursor opacity from 0 to 1. Default: 1. */
  opacity?: number;
  /** Multiplier for cursor movement physics. Default: 1. */
  movementSpeed?: number;
}

export interface AnimationOptions {
  /** Start after capture is complete. Default: true. */
  autoplay?: boolean;
  /** Desired duration for automatic scroll tours, in milliseconds. 0 disables timed tours. */
  duration?: number;
  /** Delay before autoplay, in milliseconds. Default: 1500. */
  delay?: number;
  /** Multiplier applied to the original task animation timing. Default: 1. */
  speed?: number;
  /** Start a new capture after completion. Default: false. */
  loop?: boolean;
}

export interface ReconstructionOptions {
  /** Reconstruct visible text with styled clones and the original typing animation. Default: true. */
  text?: boolean;
  /** Reconstruct images and media; unavailable media receives a fallback tile. Default: true. */
  images?: boolean;
  /** Reconstruct filled boxes and shapes. Default: true. */
  shapes?: boolean;
  /** Reconstruct borders and horizontal rules. Default: true. */
  borders?: boolean;
  /** Include media elements such as canvas, video, and embedded frames. Default: true. */
  media?: boolean;
}

export interface AppearanceOptions {
  /** Solid overlay background. CSS color value. Defaults to the target page background. */
  background?: string;
  /** Optional CSS background-image value, including gradients. */
  backgroundGradient?: string;
  /** Show the Figma-style ruler and alignment guides. Default: true. */
  showGuides?: boolean;
  /** Show dimensions, spacing badges, and measurement lines. Default: true. */
  showMeasurements?: boolean;
}

export interface InteractionOptions {
  /** Let scroll gestures start and steer the reconstruction. Default: true. */
  scrollAware?: boolean;
  /** Let the swarm flock around the pointer. Default: true. */
  mouseInteraction?: boolean;
  /** Treat touch pointers as mouse interaction. Default: true. */
  touchInteraction?: boolean;
  /** Enable Escape and M keyboard controls. Default: true. */
  keyboardControls?: boolean;
}

export interface PerformanceOptions {
  /** Maximum rendering frame rate, clamped to 1–120. Default: 60. */
  maxFps?: number;
  /** Pause engine updates while the document is hidden. Default: true. */
  pauseWhenHidden?: boolean;
}

export interface AudioOptions {
  /** Enable synthesized Web Audio effects. Default: false. */
  enabled?: boolean;
  /** Master audio volume from 0 to 1. Default: 0.35. */
  volume?: number;
  /** Observe synthesized sound events without receiving audio data. */
  onSound?: (name: string, args: unknown[]) => void;
}

export interface BehaviorOptions {
  /** Fade back to the original page when all tasks finish. Default: false. */
  restoreOnComplete?: boolean;
}

export interface MediaOptions {
  /**
   * Optional caller-provided screenshot adapter. Return a data URL captured with
   * the user's consent; ordinary pages cannot capture arbitrary tabs.
   */
  capture?: () => Promise<string | null> | string | null;
}

export interface SwarmOptions {
  /** DOM subtree to inspect. Defaults to document.body at start time. */
  target?: SwarmTarget;
  cursors?: CursorOptions;
  animation?: AnimationOptions;
  reconstruction?: ReconstructionOptions;
  appearance?: AppearanceOptions;
  interaction?: InteractionOptions;
  performance?: PerformanceOptions;
  audio?: AudioOptions;
  behavior?: BehaviorOptions;
  media?: MediaOptions;
}

export interface ResolvedSwarmOptions {
  target?: SwarmTarget;
  media?: MediaOptions;
  cursors: Required<CursorOptions>;
  animation: Required<AnimationOptions>;
  reconstruction: Required<ReconstructionOptions>;
  appearance: Pick<AppearanceOptions, "background" | "backgroundGradient"> &
    Required<Pick<AppearanceOptions, "showGuides" | "showMeasurements">>;
  interaction: Required<InteractionOptions>;
  performance: Required<PerformanceOptions>;
  audio: Required<Pick<AudioOptions, "enabled" | "volume">> & Pick<AudioOptions, "onSound">;
  behavior: Required<BehaviorOptions>;
}
