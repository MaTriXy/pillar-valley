import { Easing } from "react-native";

/**
 * Lightweight tween manager driven by the game's own render loop. Replaces a
 * previous implementation built on React Native's `Animated` API, which spent
 * a lot of time bridging values through the (JS-driver) Animated subsystem
 * even though every consumer was just mutating plain numeric properties on
 * Three.js objects.
 *
 * Each tween mutates a numeric field on `target` in place. Call
 * `RNAnimator.tick(deltaMs)` once per frame from the render loop to advance
 * every active tween.
 */

type EasingFn = (input: number) => number;

interface PropTween {
  key: string;
  from: number;
  delta: number;
}

interface Tween {
  target: any;
  delay: number;
  duration: number;
  elapsed: number;
  primed: boolean;
  props: PropTween[];
  easing: EasingFn;
  onUpdate?: () => void;
  onComplete?: () => void;
}

const active: Tween[] = [];

export class RNAnimator {
  static to<T extends Record<string, any>>(
    target: T,
    duration: number,
    props: Partial<T>,
    settings: {
      delay?: number;
      onComplete?: () => void;
      onUpdate?: () => void;
      easing?: EasingFn;
    } = {}
  ) {
    const tween: Tween = {
      target,
      delay: settings.delay ?? 0,
      duration: Math.max(1, duration),
      elapsed: 0,
      primed: false,
      // We capture `from` lazily once the delay elapses so the start value
      // matches whatever the property is at that moment, not at schedule time.
      props: Object.keys(props).map((key) => ({
        key,
        from: 0,
        delta: (props as any)[key] as number,
      })),
      easing: settings.easing ?? Easing.linear,
      onUpdate: settings.onUpdate,
      onComplete: settings.onComplete,
    };
    active.push(tween);
  }

  /**
   * Advance every running tween by `deltaMs` milliseconds. Tweens that finish
   * during the tick fire `onComplete` and are removed from the active set.
   */
  static tick(deltaMs: number) {
    if (active.length === 0) return;
    // Iterate backwards so splices don't shift the index of pending tweens.
    for (let i = active.length - 1; i >= 0; i--) {
      const t = active[i];
      let step = deltaMs;

      if (t.delay > 0) {
        t.delay -= step;
        if (t.delay > 0) continue;
        // Carry the remainder into elapsed so short tweens don't lose a frame.
        step = -t.delay;
        t.delay = 0;
      }

      if (!t.primed) {
        for (const p of t.props) {
          const start = (t.target[p.key] as number) ?? 0;
          p.delta -= start;
          p.from = start;
        }
        t.primed = true;
      }

      t.elapsed += step;
      const raw = t.elapsed >= t.duration ? 1 : t.elapsed / t.duration;
      const eased = t.easing(raw);

      for (const p of t.props) {
        t.target[p.key] = p.from + p.delta * eased;
      }

      t.onUpdate?.();

      if (raw >= 1) {
        active.splice(i, 1);
        t.onComplete?.();
      }
    }
  }

  /**
   * Cancel any in-flight tweens that target the given object. Used to prevent
   * an outgoing animation from racing an incoming one on the same property.
   */
  static killOf(target: any) {
    if (active.length === 0) return;
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].target === target) active.splice(i, 1);
    }
  }

  /**
   * Drop every active tween — used when the game is reset.
   */
  static clear() {
    active.length = 0;
  }
}
