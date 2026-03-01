import { createSignal, onCleanup, type Accessor } from "solid-js";

export type TimelineEvent = {
  timestamp: number;
  execute: () => void;
};

export type TimelineOptions = {
  loop?: boolean;
  onComplete?: () => void;
  onLoop?: () => void;
  trackProgress?: boolean;
};

export type TimelineControls = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  invalidateCache: () => void;
  isRunning: Accessor<boolean>;
  progress: Accessor<number>;
};

export type BuildEventsResult = TimelineEvent[] | { events: TimelineEvent[]; duration: number };

export function createAnimationTimeline(
  buildEvents: () => BuildEventsResult,
  totalDuration: number,
  options: TimelineOptions = {},
): TimelineControls {
  const { loop = false, onComplete, onLoop, trackProgress = false } = options;

  const [isRunning, setIsRunning] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  let animationFrameId: ReturnType<typeof requestAnimationFrame> | undefined;
  let startTime = 0;
  let events: TimelineEvent[] = [];
  let effectiveDuration = totalDuration;
  let nextEventIndex = 0;
  let isRunningInternal = false;
  let eventsCached = false;

  const buildAndCache = () => {
    const result = buildEvents();
    if (Array.isArray(result)) {
      events = result;
      effectiveDuration = totalDuration;
    } else {
      events = result.events;
      effectiveDuration = result.duration;
    }
    eventsCached = true;
  };

  const executeAllEvents = () => {
    if (!eventsCached) {
      buildAndCache();
    }
    events.forEach((event) => event.execute());
    if (trackProgress) setProgress(1);
    onComplete?.();
  };

  const animate = () => {
    if (!isRunningInternal) return;

    const elapsed = performance.now() - startTime;

    while (nextEventIndex < events.length && elapsed >= events[nextEventIndex].timestamp) {
      events[nextEventIndex].execute();
      nextEventIndex++;
    }

    if (trackProgress) {
      setProgress(Math.min(elapsed / effectiveDuration, 1));
    }

    if (elapsed >= effectiveDuration) {
      if (loop) {
        onLoop?.();
        if (!eventsCached) {
          buildAndCache();
        }
        nextEventIndex = 0;
        if (trackProgress) setProgress(0);
        startTime = performance.now();
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isRunningInternal = false;
        setIsRunning(false);
        if (trackProgress) setProgress(1);
        onComplete?.();
      }
    } else {
      animationFrameId = requestAnimationFrame(animate);
    }
  };

  const resetInternal = () => {
    if (!eventsCached) {
      buildAndCache();
    }
    nextEventIndex = 0;
    if (trackProgress) setProgress(0);
  };

  const start = () => {
    if (isRunningInternal) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      executeAllEvents();
      return;
    }

    resetInternal();
    startTime = performance.now();
    isRunningInternal = true;
    setIsRunning(true);
    animationFrameId = requestAnimationFrame(animate);
  };

  const stop = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }
    isRunningInternal = false;
    setIsRunning(false);
  };

  const reset = () => {
    stop();
    resetInternal();
  };

  const invalidateCache = () => {
    eventsCached = false;
  };

  onCleanup(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  return {
    start,
    stop,
    reset,
    invalidateCache,
    isRunning,
    progress,
  };
}
