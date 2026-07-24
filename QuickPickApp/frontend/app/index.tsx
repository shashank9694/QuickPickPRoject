import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const navigated = useRef(false);

  useEffect(() => {
    if (loading || navigated.current) return;
    navigated.current = true;

    let target: string;
    if (!user) target = "/(auth)/phone";
    else if (user.role === "pending") target = "/(auth)/register";
    else if (user.role === "customer") target = "/(customer)/home";
    else if (user.role === "shopkeeper") target = "/(shopkeeper)/dashboard";
    else if (user.role === "admin") target = "/(admin)/shops";
    else target = "/(auth)/phone";

    // setTimeout ensures the navigator is fully mounted before we navigate
    setTimeout(() => {
      try {
        router.replace(target as any);
      } catch {
        // ignore - navigation may not be ready yet, will retry next effect
        navigated.current = false;
      }
    }, 150);
  }, [loading, user, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}
