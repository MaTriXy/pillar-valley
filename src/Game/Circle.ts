import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { setFullMeshAlpha } from "./GameObject";

class AlphaMesh extends Mesh {
  private _alpha: number = 1;

  get alpha(): number {
    return this._alpha;
  }

  set alpha(value: number) {
    this._alpha = value;
    setFullMeshAlpha(this, value);
  }
}

/**
 * The landing pulse on top of each pillar. Rendered as an unlit additive disc
 * so it reads as a soft halo of light rather than an opaque white pancake.
 */
class CircleMesh extends AlphaMesh {
  constructor({
    radius,
    color,
  }: {
    radius: number;
    color: number | string | Color;
  }) {
    super(
      new CircleGeometry(radius, 32),
      new MeshBasicMaterial({
        color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    );
  }

  reset = () => {
    this.visible = false;
    this.scale.x = 0.001;
    this.scale.y = 0.001;
    this.alpha = 0.45;
  };

  update = () => {};
}

export default CircleMesh;
