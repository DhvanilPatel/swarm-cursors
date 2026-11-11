import type { ResolvedSwarmOptions, SwarmOptions } from "../types/options";

const DEFAULT_COLORS = [
  "#F24E1E",
  "#A259FF",
  "#1ABCFE",
  "#0ACF83",
  "#FF7262",
  "#FFC700",
  "#9747FF",
  "#E8467C",
  "#14AE5C",
  "#0D99FF",
  "#FF8A00",
  "#00B5CE",
];

export function resolveOptions(
  input: SwarmOptions = {},
  previous?: ResolvedSwarmOptions,
): ResolvedSwarmOptions {
  const resolved: ResolvedSwarmOptions = {
    target: input.target ?? previous?.target,
    media: { ...previous?.media, ...input.media },
    cursors: {
      count: 18,
      minCount: 8,
      maxCount: 48,
      size: 16,
      colors: [...DEFAULT_COLORS],
      opacity: 1,
      movementSpeed: 1,
      ...previous?.cursors,
      ...input.cursors,
    },
    animation: {
      autoplay: true,
      duration: 0,
      delay: 1500,
      speed: 1,
      loop: false,
      ...previous?.animation,
      ...input.animation,
    },
    reconstruction: {
      text: true,
      images: true,
      shapes: true,
      borders: true,
      media: true,
      ...previous?.reconstruction,
      ...input.reconstruction,
    },
    appearance: {
      showGuides: true,
      showMeasurements: true,
      ...previous?.appearance,
      ...input.appearance,
    },
    interaction: {
      scrollAware: true,
      mouseInteraction: true,
      touchInteraction: true,
      keyboardControls: true,
      ...previous?.interaction,
      ...input.interaction,
    },
    performance: {
      maxFps: 60,
      pauseWhenHidden: true,
      ...previous?.performance,
      ...input.performance,
    },
    audio: {
      enabled: false,
      volume: 0.35,
      ...previous?.audio,
      ...input.audio,
    },
    behavior: {
      restoreOnComplete: false,
      ...previous?.behavior,
      ...input.behavior,
    },
  };

  validateOptions(resolved);
  return resolved;
}

export function validateOptions(options: ResolvedSwarmOptions): void {
  const { cursors, animation, audio, performance: performanceOptions } = options;
  for (const [key, value] of Object.entries({
    count: cursors.count,
    minCount: cursors.minCount,
    maxCount: cursors.maxCount,
  })) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`cursors.${key} must be a positive integer`);
    }
  }
  if (cursors.minCount > cursors.maxCount) {
    throw new RangeError("cursors.minCount must not exceed cursors.maxCount");
  }
  if (cursors.count < cursors.minCount || cursors.count > cursors.maxCount) {
    throw new RangeError("cursors.count must be between minCount and maxCount");
  }
  if (!Number.isFinite(cursors.size) || cursors.size < 4 || cursors.size > 64) {
    throw new RangeError("cursors.size must be between 4 and 64 pixels");
  }
  if (!Number.isFinite(cursors.opacity) || cursors.opacity < 0 || cursors.opacity > 1) {
    throw new RangeError("cursors.opacity must be between 0 and 1");
  }
  if (!Number.isFinite(cursors.movementSpeed) || cursors.movementSpeed <= 0 || cursors.movementSpeed > 5) {
    throw new RangeError("cursors.movementSpeed must be greater than 0 and at most 5");
  }
  if (!cursors.colors.length || cursors.colors.some((color) => typeof color !== "string" || !color.trim())) {
    throw new TypeError("cursors.colors must contain at least one non-empty CSS color");
  }
  if (!Number.isFinite(animation.duration) || animation.duration < 0) {
    throw new RangeError("animation.duration must be a non-negative number of milliseconds");
  }
  if (!Number.isFinite(animation.delay) || animation.delay < 0) {
    throw new RangeError("animation.delay must be a non-negative number of milliseconds");
  }
  if (!Number.isFinite(animation.speed) || animation.speed <= 0 || animation.speed > 5) {
    throw new RangeError("animation.speed must be greater than 0 and at most 5");
  }
  if (!Number.isFinite(audio.volume) || audio.volume < 0 || audio.volume > 1) {
    throw new RangeError("audio.volume must be between 0 and 1");
  }
  if (!Number.isFinite(performanceOptions.maxFps) || performanceOptions.maxFps < 1 || performanceOptions.maxFps > 120) {
    throw new RangeError("performance.maxFps must be between 1 and 120");
  }
}
