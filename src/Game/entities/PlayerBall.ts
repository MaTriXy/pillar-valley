import { Mesh, CylinderGeometry, MeshPhongMaterial } from "three";
import Colors from "../../constants/Colors";
import Settings from "../../constants/Settings";
import Circle from "../Circle";
import GameObject from "../GameObject";
import { Easing } from "react-native";
import { RNAnimator } from "../utils/animator";

const radius = 26.6666667 / 2;
const PlayerBallGeom = new CylinderGeometry(radius, radius, 9, 24);
const PlayerBallMaterial = new MeshPhongMaterial({
  color: Colors.gold,
});

class PlayerBall extends GameObject {
  private circle?: Circle;

  loadAsync = async (scene: any) => {
    // Geometry is shared (every ball is identical); each ball gets its own
    // material clone so independent opacity / hide animations don't interfere.
    const mesh = new Mesh(PlayerBallGeom, PlayerBallMaterial.clone());
    mesh.position.y = 4.5;
    this.add(mesh);

    const circle = new Circle({ radius: 1, color: 0xffffff });
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.5;
    this.circle = circle;
    circle.reset();
    this.add(circle);

    await super.loadAsync(scene);
  };

  hide = ({
    onComplete,
    duration = 0.7,
  }: { onComplete?: () => void; duration?: number } = {}) => {
    this.circle?.reset();
    RNAnimator.to(
      this,
      1000 * duration,
      {
        alpha: 0,
      },
      {
        onComplete,
      }
    );
  };

  landed = (perfection: number, targetRadius: number) => {
    if (!Settings.circleEnabled || !this.circle) return;

    this.circle.visible = true;

    const duration = 700;

    const scale = targetRadius + targetRadius * 0.5 * perfection;

    RNAnimator.to(
      this.circle.scale,
      duration,
      {
        x: scale,
        y: scale,
      },
      {
        easing: Easing.out(Easing.cubic),
      }
    );

    RNAnimator.to(
      this.circle,
      duration,
      {
        alpha: 0,
      },
      {
        easing: Easing.out(Easing.cubic),
        onComplete: () => {
          this.circle?.reset();
        },
      }
    );
  };
}

export default PlayerBall;
