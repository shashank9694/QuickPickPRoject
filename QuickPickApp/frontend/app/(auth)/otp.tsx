import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function OtpScreen() {
  const router = useRouter();
  const { phone, mockOtp } = useLocalSearchParams<{ phone: string; mockOtp: string }>();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { signIn } = useAuth();

  const submit = async () => {
    setErr("");
    if (otp.length !== 6) {
      setErr("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { phone, otp });
      await signIn(data.access_token, data.user);
      const role = data.user.role;
      if (data.is_new_user || role === "pending") {
        router.replace("/(auth)/register");
      } else if (role === "customer") {
        router.replace("/(customer)/home");
      } else if (role === "shopkeeper") {
        router.replace("/(shopkeeper)/dashboard");
      } else {
        router.replace("/(admin)/shops");
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity testID="otp-back-btn" onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.badge}>VERIFICATION</Text>
          <Text style={styles.title}>Enter the 6-digit code</Text>
          <Text style={styles.sub}>Sent to {phone}</Text>

          {mockOtp ? (
            <View style={styles.mockBox}>
              <Ionicons name="information-circle" size={18} color={colors.brandDark} />
              <Text style={styles.mockText}>Mock OTP (dev): <Text style={styles.mockCode}>{mockOtp}</Text></Text>
            </View>
          ) : null}

          <TextInput
            testID="otp-input"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otp}
            placeholder="••••••"
            placeholderTextColor="#CBD5E1"
            autoFocus
          />

          {err ? <Text style={styles.err} testID="otp-error">{err}</Text> : null}

          <TouchableOpacity testID="verify-otp-btn" style={[styles.cta, loading && { opacity: 0.7 }]} disabled={loading} onPress={submit} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Verify & Continue</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  badge: { ...font.caption, color: colors.brandDark, marginBottom: spacing.md },
  title: { ...font.h1, color: colors.text, marginBottom: spacing.sm },
  sub: { ...font.body, color: colors.textMuted, marginBottom: spacing.xl },
  mockBox: { backgroundColor: "#ECFDF5", borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg, borderWidth: 1, borderColor: "#A7F3D0" },
  mockText: { ...font.small, color: colors.brandDark },
  mockCode: { fontWeight: "800", letterSpacing: 2 },
  otp: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 32, letterSpacing: 12, textAlign: "center", color: colors.text, fontWeight: "800", height: 72 },
  err: { color: colors.danger, ...font.small, marginTop: spacing.md },
  cta: { backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  ctaText: { color: "#fff", ...font.h3 },
});
