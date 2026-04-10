import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Material,
  Mesh,
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
  angle: number,
): { x: number; y: number } => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

// One unit-prism geometry shared by every platform — we vary the visible
// size by scaling the mesh per-instance. The taper ratio (top radius / bottom
// radius) is fixed at 1 / 0.2, matching the original look. Sharing keeps
// pillar churn from re-uploading vertex buffers to the GPU.
const PLATFORM_TAPER = 0.2;
const PLATFORM_HEIGHT = 1000;
// Fraction of each hex side consumed by the chamfer at one end (0 = sharp
// corners, 0.5 = fully bevelled away). A small value gives just enough bevel
// to catch a highlight along the vertical edge.
const PLATFORM_BEVEL = 0.05;

// Beveled hexagonal frustum: 6 main side faces + 6 narrow chamfer faces
// running the full height. With `flatShading` on the material, each face
// resolves as a single shade so all 12 sides read clearly.
function createBeveledHexFrustum(
  topRadius: number,
  bottomRadius: number,
  height: number,
  bevel: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  const addRing = (y: number, scale: number) => {
    for (let i = 0; i < 6; i++) {
      const a1 = (i * Math.PI) / 3;
      const a2 = ((i + 1) * Math.PI) / 3;
      const c1x = Math.cos(a1) * scale;
      const c1z = Math.sin(a1) * scale;
      const c2x = Math.cos(a2) * scale;
      const c2z = Math.sin(a2) * scale;
      // Two chamfer vertices along the side connecting hexagon corners i and
      // i+1, set inward from each corner by `bevel` of the side length.
      positions.push(
        c1x * (1 - bevel) + c2x * bevel,
        y,
        c1z * (1 - bevel) + c2z * bevel,
      );
      positions.push(
        c2x * (1 - bevel) + c1x * bevel,
        y,
        c2z * (1 - bevel) + c1z * bevel,
      );
    }
  };

  // Top ring: indices 0..11; Bottom ring: indices 12..23.
  addRing(height / 2, topRadius);
  addRing(-height / 2, bottomRadius);

  // 12 quad side faces (alternating main face / chamfer face), wound CCW
  // when viewed from outside the prism.
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    const a = i;
    const b = next;
    const c = i + 12;
    const d = next + 12;
    indices.push(a, b, c, b, d, c);
  }

  // Top cap (fan around a center vertex), wound CCW from above.
  const topCenter = positions.length / 3;
  positions.push(0, height / 2, 0);
  for (let i = 0; i < 12; i++) {
    indices.push(topCenter, (i + 1) % 12, i);
  }

  // Bottom cap, wound CCW from below.
  const bottomCenter = positions.length / 3;
  positions.push(0, -height / 2, 0);
  for (let i = 0; i < 12; i++) {
    indices.push(bottomCenter, 12 + i, 12 + ((i + 1) % 12));
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

const sharedPlatformGeometry = createBeveledHexFrustum(
  1,
  PLATFORM_TAPER,
  PLATFORM_HEIGHT,
  PLATFORM_BEVEL,
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
  private lightness = 66;
  // Animated 0..1 — drives a bright-orange emissive flash on land that fades
  // back to neutral.
  private flash = 0;
  // Pre-allocated so the per-frame color animation doesn't churn through
  // `new Color(...)` and a string every tick.
  private readonly _color = new Color();

  private writeColor(target: Color = this._color) {
    target.setHSL(this.hue / 360, this.saturation / 100, this.lightness / 100);
    return target;
  }

  get color() {
    return this.writeColor();
  }

  loadAsync = async (scene: any) => {
    this.radius = randomRange(radius, radius * 1.9);
    this.platformMaterial = new MeshPhongMaterial({
      color: this.writeColor(),
      flatShading: true,
      emissive: 0x000000,
    });
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
          },
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
          gem.driftAngle,
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
    this._lightUp();
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
      },
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
      { easing: Easing.out(Easing.cubic) },
    );
  };

  public becomeTarget = () => {
    // this._animateColorTo(33);
  };

  // Snappy "land on me" reaction: punch the base color toward a vivid orange
  // *and* fire a quick emissive flash that decays back to nothing. Two tweens
  // on different curves so the flash front-loads the energy and the base
  // color settles in behind it.
  private _lightUp = () => {
    if (!this.platformMaterial) return;

    // 1) Settle into a brighter, more saturated orange that stays.
    RNAnimator.to(
      this,
      450,
      {
        hue: 28,
        saturation: 92,
        lightness: 62,
      },
      {
        easing: Easing.out(Easing.cubic),
        onUpdate: () => {
          if (this.platformMaterial)
            this.writeColor(this.platformMaterial.color);
        },
      },
    );

    // 2) Emissive flash: jump to full, ease back to 0 over a longer tail so
    //    the pillar visibly "lights up" the moment the player touches down.
    this.flash = 1;
    if (this.platformMaterial)
      this.platformMaterial.emissive.setRGB(1, 0.45, 0.1);
    RNAnimator.to(
      this,
      650,
      {
        flash: 0,
      },
      {
        easing: Easing.out(Easing.quad),
        onUpdate: () => {
          if (!this.platformMaterial) return;
          // Bright orange flash, scaled by `flash` so it fades to black.
          this.platformMaterial.emissive.setRGB(
            1.0 * this.flash,
            0.45 * this.flash,
            0.1 * this.flash,
          );
        },
      },
    );
  };

  private getEndPosition = (): number => randomRange(-1500, -1000);
}

export default Platform;
