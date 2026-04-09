import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { useGlobalAudio } from "./zustand/models";

const audio: Record<string, number> = {
  // Common
  button_in: require("./assets/audio/button_in.wav"),
  button_out: require("./assets/audio/button_out.wav"),
  unlock: require("./assets/audio/unlock.mp3"),
  // Pillar Valley
  // song: require("./assets/audio/song.mp3"),
};

class AudioManager {
  players: Record<string, AudioPlayer> = {};

  private loadAsync = async (name: string) => {
    if (typeof window === "undefined") return;
    await this.setupAsync();

    const existing = this.players[name];
    if (existing) return existing;

    const source = audio[name];
    if (!source) return;
    const player = createAudioPlayer(source);
    this.players[name] = player;
    return player;
  };

  playAsync = async (name: string, isLooping: boolean = false) => {
    if (typeof window === "undefined") return;

    if (!useGlobalAudio.getState().enabled || process.env.EXPO_OS === "web") {
      return;
    }

    const player = await this.loadAsync(name);
    if (!player) return;
    try {
      player.seekTo(0);
      player.loop = isLooping;
      player.play();
    } catch (error) {
      console.warn("Error playing audio", { error });
    }
  };

  stopAsync = async (name: string) => {
    if (typeof window === "undefined") return;
    const player = await this.loadAsync(name);
    if (!player) return;
    player.pause();
    player.seekTo(0);
  };

  volumeAsync = async (name: string, volume: number) => {
    if (typeof window === "undefined") return;
    const player = await this.loadAsync(name);
    if (player) player.volume = volume;
  };

  pauseAsync = async (name: string) => {
    if (typeof window === "undefined") return;
    (await this.loadAsync(name))?.pause();
  };

  async configureExperienceAudioAsync() {
    if (typeof window === "undefined") return;

    return setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "mixWithOthers",
    });
  }

  _isSetup = false;
  setupPromise: Promise<void> | null = null;
  setupAsync = async () => {
    if (this._isSetup) {
      return this.setupPromise;
    }
    this._isSetup = true;
    this.setupPromise = (async () => {
      await this.configureExperienceAudioAsync();
      this.setupPromise = null;
    })();
    return this.setupPromise;
  };
}

export default new AudioManager();
