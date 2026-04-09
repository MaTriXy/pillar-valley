import {
  Color,
  Mesh,
  CylinderGeometry,
  Material,
  MeshPhongMaterial,
} from "three";

import { Easing } from "react-native";

import DoubleGem from "./DoubleGem";
import Gem from "./Gem";
import Settings from "../../constants/Settings";
import GameObject from "../GameObject";
import randomRange from "../utils/randomRange";
import { RNAnimator } from "../utils/animator";

const radius = 33.3333333 / 2;

const pointForGem = (
  radius: number,
  angle: number
): { x: number; y: number } => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

// One unit-cylinder geometry shared by every platform — we vary the visible
// size by scaling the mesh per-instance. The taper ratio (top radius / bottom
// radius) is fixed at 1 / 0.2, matching the original look. Sharing keeps
// pillar churn from re-uploading vertex buffers to the GPU.
const PLATFORM_TAPER = 0.2;
const PLATFORM_HEIGHT = 1000;
const sharedPlatformGeometry = new CylinderGeometry(
  1,
  PLATFORM_TAPER,
  PLATFORM_HEIGHT,
  24
);

class PlatformMesh extends Mesh {
  constructor(size: number, material: Material) {
    super(sharedPlatformGeometry, material);
    // Compensate the taper: a unit cylinder has top=1 / bottom=0.2, so
    // scaling x/z by `size` yields the same silhouette as the old
    // `new CylinderGeometry(size, size * 0.2, 1000, 24)`.
    this.scale.set(size, 1, size);
  }

  set y(y: number) {
    this.position.y = y;
  }
  get y(): number {
    return this.position.y;
  }

  _alpha = 1;
  get alpha(): number {
    return this._alpha;
  }
  set alpha(value: number) {
    this._alpha = value;
    // Pillars only have a single material and no Mesh children, so we can
    // skip the recursive traverse and toggling `transparent` (which would
    // force a shader rebuild every time the value crossed 1).
    const m = this.material as MeshPhongMaterial;
    m.transparent = true;
    m.opacity = value;
  }
}

let pillarId = 0;
function getNewPillarId() {
  return pillarId++;
}
class Platform extends GameObject {
  public pillarId: number = getNewPillarId();
  radius: number = 0;
  public gems: Gem[] = [];
  public lastAngle: number = 0;
  private playerDirection: number = 0;
  mesh?: PlatformMesh;
  private platformMaterial?: MeshPhongMaterial;

  private saturation = 0;
  private hue = 19;
  // Pre-allocated so the per-frame color animation doesn't churn through
  // `new Color(...)` and a string every tick.
  private readonly _color = new Color();

  private writeColor(target: Color = this._color) {
    target.setHSL(this.hue / 360, this.saturation / 100, 0.66);
    return target;
  }

  get color() {
    return this.writeColor();
  }

  loadAsync = async (scene: any) => {
    this.radius = randomRange(radius, radius * 1.9);
    this.platformMaterial = new MeshPhongMaterial({ color: this.writeColor() });
    this.mesh = new PlatformMesh(this.radius, this.platformMaterial);
    this.mesh.y = -500;
    this.add(this.mesh);

    await super.loadAsync(scene);
  };

  public updateDirection = (direction: number) => {
    this.playerDirection = direction;

    if (this.playerDirection === undefined) return;

    if (this.gems && this.gems.length) {
      const gemCount = this.gems.length;
      let degrees = Math.PI * 0.75;
      if (this.playerDirection) degrees *= this.playerDirection;
      const subDiv = degrees / gemCount;
      for (let i = 0; i < gemCount; i += 1) {
        const gem = this.gems[i];
        const dir = this.lastAngle + subDiv * i;
        const { x, y } = pointForGem(Settings.ballDistance, dir);
        gem.position.x = x;
        gem.position.z = y;
        gem.position.y = 0;
        gem.driftAngle = dir;
      }
    }
  };

  private ensureGems = async (count: number): Promise<void> => {
    if (!this.gems) this.gems = [];

    while (this.gems.length < count) {
      let gem: Gem;
      if (count > 3 && this.gems.length === count - 1) {
        gem = new DoubleGem();
      } else {
        gem = new Gem();
      }
      gem.scale.set(0.001, 0.001, 0.001);
      this.gems.push(gem);
      await this.add(gem);
    }

    this.updateDirection(this.playerDirection);
  };

  public showGems = async (count: number) => {
    if (count > 2) {
      await this.ensureGems(count);

      for (let i = 0; i < this.gems.length; i += 1) {
        const gem = this.gems[i];

        RNAnimator.to(
          gem,
          300,
          {
            alpha: 1,
            _scale: 1,
            y: 0,
          },
          {
            delay: 1000 * ((i + 1) * 0.1),
            onComplete: () => (gem.canBeCollected = true),
          }
        );
      }
    }
  };

  private animateGemsOut = () => {
    if (this.gems) {
      for (let i = 0; i < this.gems.length; i += 1) {
        const gem = this.gems[i];
        const { x, y } = pointForGem(
          Settings.ballDistance * 1.5,
          gem.driftAngle
        );

        RNAnimator.to(gem, 400, {
          alpha: 0,
          x,
          z: y,
        });
      }
    }
  };

  public becomeCurrent = () => {
    this._animateColorTo(66);
  };

  public animateOut = () => {
    this.animateGemsOut();
    if (!this.mesh) return;

    // If this pillar is mid-`animateIn`, kill that tween so the outgoing
    // motion doesn't fight the still-rising one on the same target.
    RNAnimator.killOf(this.mesh);

    // Drop and fade together on a single tween so the pillar is always
    // *moving* while it dims — never just fading in place. Quadratic ease-in
    // gives a gravity-like accelerating fall without the harsh snap of a
    // pure linear drop.
    RNAnimator.to(
      this.mesh,
      randomRange(650, 800),
      {
        alpha: 0,
        y: randomRange(-1500, -1200),
      },
      {
        delay: randomRange(0, 70),
        easing: Easing.in(Easing.quad),
        onComplete: () => this.destroy(),
      }
    );
  };

  public animateIn = () => {
    if (!this.mesh) return;
    RNAnimator.killOf(this.mesh);
    this.mesh.y = this.getEndPosition();
    RNAnimator.to(
      this.mesh,
      randomRange(500, 700),
      { y: -500 },
      { easing: Easing.out(Easing.cubic) }
    );
  };

  public becomeTarget = () => {
    // this._animateColorTo(33);
  };

  private _animateColorTo = (saturation: number) => {
    RNAnimator.to(
      this,
      500,
      {
        saturation,
      },
      {
        onUpdate: () => {
          // Mutate the existing material color in place — no allocations.
          if (this.platformMaterial) this.writeColor(this.platformMaterial.color);
        },
      }
    );
  };

  private getEndPosition = (): number => randomRange(-1500, -1000);
}

export default Platform;
