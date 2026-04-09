import invariant from "invariant";
import React from "react";
import {
  AppState,
  LayoutChangeEvent,
  PixelRatio,
  StyleSheet,
} from "react-native";
import { Canvas, type CanvasRef, type RNCanvasContext } from "react-native-wgpu";
import * as THREE from "three";
import type { Renderer } from "three/webgpu";

import { makeWebGPURenderer } from "@/lib/webgpu-renderer";

export type ResizeEvent = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  pixelRatio: number;
};

export type RendererEvent = {
  renderer: Renderer;
  width: number;
  height: number;
  pixelRatio: number;
};

type Props = {
  onResize?: (event: ResizeEvent) => void;
  isPaused: boolean;
  onShouldReloadContext: boolean;
  onContextCreate: (event: RendererEvent) => void | Promise<void>;
  onRender: (deltaTime: number, time: number) => void;
};

export default class GraphicsView extends React.Component<Props> {
  gpuContext: RNCanvasContext | null = null;
  renderer: Renderer | null = null;
  canvasRef = React.createRef<CanvasRef>();
  rafID?: number;
  layoutWidth = 0;
  layoutHeight = 0;
  initializing = false;

  static defaultProps = {
    onShouldReloadContext: process.env.EXPO_OS !== "web",
    isPaused: false,
  };

  state = {
    appState: AppState.currentState,
    id: Date.now() + Math.random(),
  };

  componentWillUnmount() {
    this.destroy();
  }

  destroy = () => {
    this.gpuContext = null;
    this.renderer = null;
    if (this.rafID) {
      cancelAnimationFrame(this.rafID);
    }
  };

  _onLayout = ({
    nativeEvent: {
      layout: { x, y, width, height },
    },
  }: LayoutChangeEvent) => {
    this.layoutWidth = width;
    this.layoutHeight = height;

    if (!this.gpuContext && !this.initializing && this.canvasRef.current) {
      this._initialize();
      return;
    }

    if (this.renderer) {
      this.renderer.setSize(width, height);
      if (this.props.onResize) {
        const scale = PixelRatio.get();
        this.props.onResize({ x, y, width, height, scale, pixelRatio: scale });
      }
    }
  };

  _initialize = async () => {
    if (this.initializing || this.gpuContext || !this.canvasRef.current) return;
    this.initializing = true;

    const ctx = this.canvasRef.current.getContext("webgpu");
    invariant(ctx, "react-native-wgpu: failed to obtain WebGPU context");
    this.gpuContext = ctx;

    const { onContextCreate, onRender } = this.props;
    invariant(
      onRender,
      "GraphicsView._initialize: `onRender` must be defined."
    );
    invariant(
      onContextCreate,
      "GraphicsView._initialize: `onContextCreate` must be defined."
    );

    const scale = PixelRatio.get();
    const width = this.layoutWidth || (ctx.canvas as any).width / scale;
    const height = this.layoutHeight || (ctx.canvas as any).height / scale;

    const renderer = makeWebGPURenderer(ctx);
    renderer.setPixelRatio(scale);
    renderer.setSize(width, height, false);
    // WebGPURenderer requires async init before first frame.
    await renderer.init();
    this.renderer = renderer;

    await onContextCreate({
      renderer,
      width,
      height,
      pixelRatio: scale,
    });

    const clock = new THREE.Clock();
    const render = () => {
      if (!this.gpuContext) return;
      this.rafID = requestAnimationFrame(render);
      if (!this.props.isPaused) {
        // Cap the delta so a JS hitch (asset loading, GC, app backgrounded
        // for a moment) doesn't cause tweens or game logic to jump forward
        // half a second on the next frame.
        const delta = Math.min(clock.getDelta(), 1 / 30);
        onRender(delta, clock.getElapsedTime());
        this.gpuContext.present();
      }
    };
    render();
  };

  render() {
    return (
      <Canvas
        key={this.state.id}
        ref={this.canvasRef}
        onLayout={this._onLayout}
        style={styles.container}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
