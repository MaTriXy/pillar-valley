import { Asset } from "expo-asset";
import { Easing } from "react-native";
import * as THREE from "three";

import GameObject from "./GameObject";
import MotionObserver from "./MotionObserver";
import { RNAnimator } from "./utils/animator";

class FlatMaterial extends THREE.MeshPhongMaterial {
  constructor(props: any) {
    super({
      flatShading: true,
      ...props,
    });
  }
}

/**
 * Decodes a bundled PNG into a `THREE.Texture` whose `image` is an
 * `ImageBitmap`. `react-native-wgpu` polyfills `fetch`/`Blob`/`createImageBitmap`
 * on native, so this same code path works on iOS, Android, and web.
 */
async function loadAssetTextureAsync(moduleId: number): Promise<THREE.Texture> {
  const asset = await Asset.fromModule(moduleId).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error(`Failed to resolve asset uri for module ${moduleId}`);
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement);
  // Mark the source as sRGB-encoded so the renderer decodes it to linear
  // before lighting/output instead of treating raw bytes as linear (which
  // causes the artwork to read washed out / over-bright).
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function loadMenuMaterialAsync(
  asset: any,
  color: number
): Promise<THREE.Material[]> {
  const texture = await loadAssetTextureAsync(asset);
  // Tint the unlit logo face down a touch so it sits in the same value
  // range as the lit pillar sides instead of glowing white.
  const image = new THREE.MeshBasicMaterial({ map: texture, color: 0xc8c8c8 });

  const material = new FlatMaterial({ color });

  return [material, material, image, material, material, material];
}

async function makeMenuPillarAsync(asset: any, color = 0xdb7048) {
  const width = 100;
  const depth = width * 0.33;

  const materials = await loadMenuMaterialAsync(asset, color);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(100, 1000, depth, 1, 1, 1),
    materials
  );
  mesh.position.y = -500;
  return mesh;
}

export default class MenuObject extends GameObject {
  motionObserver = new MotionObserver();

  async loadAsync() {
    this.motionObserver.start();
    const titleGroup = new THREE.Object3D();
    const offset = -30;
    titleGroup.position.x = offset;
    titleGroup.position.z = -200;

    const pillar = await makeMenuPillarAsync(
      require("../assets/images/PILLAR.png")
    );
    titleGroup.add(pillar);

    pillar.position.y = -1100;

    RNAnimator.to(
      pillar.position,
      1000 * 1.1,
      {
        y: -500,
      },
      {
        easing: Easing.out(Easing.back(1.7)),
      }
    );

    const pillarB = await makeMenuPillarAsync(
      require("../assets/images/VALLEY.png")
    );
    titleGroup.add(pillarB);

    if (pillarB.position) {
      pillarB.position.y = -1100;
      pillarB.position.x = 55;
      pillarB.position.z = 55;
      RNAnimator.to(
        pillarB.position,
        1000,
        {
          y: -530,
        },
        {
          easing: Easing.out(Easing.back(1.7)),
          delay: 100,
        }
      );
    }
    const pillarC = await makeMenuPillarAsync(
      require("../assets/images/BEGIN.png"),
      0xedcbbf
    );
    titleGroup.add(pillarC);

    pillarC.position.y = -1100;
    pillarC.position.x = 30;
    pillarC.position.z = 105;

    RNAnimator.to(
      pillarC.position,
      1000,
      {
        y: -540,
      },
      {
        easing: Easing.out(Easing.exp),
        delay: 200,
      }
    );

    this.add(titleGroup);

    this.pillars = [pillar, pillarB, pillarC];
  }
  pillars: THREE.Mesh[] = [];

  animateHidden = (onComplete: () => void) => {
    RNAnimator.to(
      this.position,
      1000,
      {
        y: -1100,
      },
      {
        easing: Easing.out(Easing.exp),
        delay: 200,
        onComplete: async () => {
          this.motionObserver.stop();
          onComplete();
        },
      }
    );
  };

  updateWithCamera = (camera: THREE.Camera) => {
    this.motionObserver.updateWithCamera(camera);
  };
}
