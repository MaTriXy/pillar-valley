import * as React from "react";
import { useAudioPlayer } from "expo-audio";

import { useGlobalAudio } from "../zustand/models";

const SONG_FILE = require("@/assets/audio/song.mp3");

function SongClient() {
  const { enabled } = useGlobalAudio();
  const player = useAudioPlayer(SONG_FILE);

  React.useEffect(() => {
    player.loop = true;
    if (enabled) {
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
    return () => {
      player.pause();
    };
  }, [enabled, player]);

  return null;
}

export const Song = typeof window === "undefined" ? () => null : SongClient;

export default Song;
