import Head from "expo-router/head";
import React from "react";
import { StyleSheet, View } from "react-native";

import GameState from "@/Game/GameState";
import AchievementPopup from "@/components/AchievementPopup";
import Footer from "@/components/Footer";
import GraphicsView from "@/components/GraphicsView";
import Paused from "@/components/Paused";
import ScoreMeta from "@/components/ScoreMeta";
import Song from "@/components/Song";
import TouchableView from "@/components/TouchableView";
import useAppState from "@/hooks/useAppState";

export default function GameScreen() {
  const machine = React.useMemo(() => new GameState(), []);
  const appState = useAppState();
  const isPaused = appState !== "active";

  return (
    <>
      <Head>
        <title>Play | Pillar Valley</title>
      </Head>
      <View style={styles.container}>
        <Song />
        <TouchableView
          style={styles.canvas}
          onTouchesBegan={machine.onTouchesBegan}
        >
          <GraphicsView
            isPaused={isPaused}
            onContextCreate={machine.onContextCreateAsync}
            onRender={machine.onRender}
            onResize={machine.onResize}
          />
        </TouchableView>
        <ScoreMeta />
        <Footer />
        {isPaused && <Paused />}
        <AchievementPopup />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F09458",
    pointerEvents: "box-none",
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
});
