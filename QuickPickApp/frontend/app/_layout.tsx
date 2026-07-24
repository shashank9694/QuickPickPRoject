import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, View, Text, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/auth";

LogBox.ignoreAllLogs(false);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
          <Stack screenOptions={{ headerShown: false, animation: "none" }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: "red", marginBottom: 12 }}>
        App Error (share this with developer):
      </Text>
      <ScrollView>
        <Text style={{ fontSize: 13, color: "#333", fontFamily: "monospace" }}>
          {error?.message ?? "Unknown error"}
        </Text>
        <Text style={{ fontSize: 11, color: "#666", marginTop: 12, fontFamily: "monospace" }}>
          {error?.stack ?? "No stack trace"}
        </Text>
      </ScrollView>
    </View>
  );
}
