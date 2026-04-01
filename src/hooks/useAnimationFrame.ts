import { useEffect, useRef, useCallback } from 'react';

type AnimationFrameCallback = (deltaTime: number, timestamp: number) => void;

/**
 * Hook that runs a callback on every animation frame.
 * Automatically cleans up when component unmounts.
 *
 * @param callback - Called every animation frame with deltaTime (ms) and timestamp
 * @param active - Whether the loop is active (default: true)
 */
export function useAnimationFrame(
  callback: AnimationFrameCallback,
  active = true
): void {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef<AnimationFrameCallback>(callback);

  // Keep the callback ref up to date without re-running the effect
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const animate = useCallback((timestamp: number) => {
    const deltaTime = previousTimeRef.current !== undefined
      ? timestamp - previousTimeRef.current
      : 0;

    previousTimeRef.current = timestamp;
    callbackRef.current(deltaTime, timestamp);

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!active) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        previousTimeRef.current = undefined;
      }
      return;
    }

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        previousTimeRef.current = undefined;
      }
    };
  }, [active, animate]);
}

/**
 * Hook that runs a callback at a specified FPS target.
 * Useful for meter/scope animations where you don't need 60fps.
 *
 * @param callback - Called at the target FPS
 * @param fps - Target frames per second (default: 30)
 * @param active - Whether the loop is active
 */
export function useThrottledAnimationFrame(
  callback: AnimationFrameCallback,
  fps = 30,
  active = true
): void {
  const interval = 1000 / fps;
  const lastFrameRef = useRef<number>(0);

  useAnimationFrame(
    useCallback(
      (deltaTime, timestamp) => {
        if (timestamp - lastFrameRef.current >= interval) {
          lastFrameRef.current = timestamp;
          callback(deltaTime, timestamp);
        }
      },
      [callback, interval]
    ),
    active
  );
}
