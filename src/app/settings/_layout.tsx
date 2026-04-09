import { router, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";

import TouchableBounce from "@/components/TouchableBounce";
import { Slate } from "@/constants/Colors";
import { SF } from "@/components/sf-symbol";
import { isGlassEffectAPIAvailable } from "expo-glass-effect";

export const unstable_settings = {
  anchor: "index",
};

function BackButtonAndroid() {
  if (process.env.EXPO_OS !== "android") {
    return null;
  }

  return (
    <TouchableBounce
      onPress={() => {
        // TODO: Fix going back multiple times when nested.
        while (router.canGoBack()) {
          router.back();
        }
      }}
    >
      <SF size={24} color="white" fallback="arrow-down" name="chevron.down" />
    </TouchableBounce>
  );
}

export default function Settings() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const sharedToolbarRight = (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={"chevron.down"}
        onPress={() => {
          router.back();
        }}
      />
    </Stack.Toolbar>
  );
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: isGlassEffectAPIAvailable()
          ? "minimal"
          : "default",
        headerTintColor: "white",
        headerStyle: {
          backgroundColor: "#21222B",
          borderBottomWidth: 0,
        },
        headerBackTitleStyle: {
          fontFamily: "Inter_500Medium",
        },

        contentStyle: {
          backgroundColor: Slate[900],
        },
        headerTitleStyle: { color: "white", fontFamily: "Inter_500Medium" },
        headerRight: BackButtonAndroid,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }}>
        {sharedToolbarRight}
      </Stack.Screen>
      <Stack.Screen name="icon" options={{ title: "App Icon" }}>
        {sharedToolbarRight}
      </Stack.Screen>
      <Stack.Screen name="licenses" options={{ title: "Licenses" }}>
        {sharedToolbarRight}
      </Stack.Screen>
    </Stack>
  );
}
