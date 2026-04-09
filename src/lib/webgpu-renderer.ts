import type { NativeCanvas } from "react-native-wgpu";
import * as THREE from "three";
// `three/webgpu` exposes `WebGPURenderer` (and the node-material system).
// Metro additionally aliases bare `three` imports to this same module so the
// runtime is consistent across all source files.
import { WebGPURenderer } from "three/webgpu";

/**
 * `THREE.WebGPURenderer` expects an HTMLCanvas-like object. `react-native-wgpu`
 * gives us a `NativeCanvas` instead. This shim adapts one to the other so the
 * renderer can read width/height and ignore DOM-only APIs without crashing.
 */
export class ReactNativeCanvas {
  constructor(private canvas: NativeCanvas) {}

  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }
  set width(width: number) {
    this.canvas.width = width;
  }
  set height(height: number) {
    this.canvas.height = height;
  }
  get clientWidth() {
    return this.canvas.width;
  }
  get clientHeight() {
    return this.canvas.height;
  }
  set clientWidth(width: number) {
    this.canvas.width = width;
  }
  set clientHeight(height: number) {
    this.canvas.height = height;
  }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event) {}
  setPointerCapture() {}
  releasePointerCapture() {}
}

export const makeWebGPURenderer = (
  context: GPUCanvasContext,
  { antialias = true }: { antialias?: boolean } = {}
) => {
  const renderer = new WebGPURenderer({
    antialias,
    // `canvas` is accepted at runtime (skill-validated) but the type omits it.
    // @ts-expect-error - extra runtime option not in WebGPURendererParameters
    canvas: new ReactNativeCanvas(context.canvas as unknown as NativeCanvas),
    context,
  });
  // Keep colors punchy: no tone mapping compression, sRGB output, and the
  // standard sRGB working space so hex colors render the way they were authored.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
};
