// This screen is no longer part of the main auth flow.
// Kept as a welcome/marketing screen for future use.
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.logoWrap}>
          <Ionicons name="bag-handle" size={44} color={colors.brand} />
        </View>
        <Text style={styles.badge}>QUICKPICK</Text>
        <Text style={styles.title}>Skip the queue.{"\n"}Pick up what you need.</Text>
        <Text style={styles.sub}>Pre-order from local shops. No waiting, no delivery fees.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.replace("/(auth)/phone")} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.footer}>By continuing you agree to QuickPick's Terms & Privacy.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  logoWrap: { width: 80, height: 80, borderRadius: radius.xl, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  badge: { ...font.caption, color: colors.brandDark, marginBottom: spacing.sm },
  title: { ...font.h1, color: colors.text, marginBottom: spacing.md, lineHeight: 40 },
  sub: { ...font.body, color: colors.textMuted, marginBottom: spacing.xxl, lineHeight: 24 },
  cta: { backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ctaText: { color: "#fff", ...font.h3 },
  footer: { ...font.small, color: colors.textSubtle, textAlign: "center", marginTop: spacing.xl },
});
