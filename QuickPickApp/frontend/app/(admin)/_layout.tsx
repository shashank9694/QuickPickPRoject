import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.replace("/");
  }, [user, loading, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 60 + insets.bottom, paddingBottom: insets.bottom + 6, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="shops" options={{ title: "Shops", tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="subscriptions" options={{ title: "Subs", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }} />
    </Tabs>
  );
}
