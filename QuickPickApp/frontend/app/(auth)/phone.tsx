import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setErr("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `+91${digits.slice(-10)}`;
      const { data } = await api.post("/auth/request-otp", { phone: fullPhone });
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: fullPhone, mockOtp: data.mock_otp },
      });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.logoWrap}>
            <Ionicons name="bag-handle" size={36} color={colors.brand} />
          </View>
          <Text style={styles.badge}>QUICKPICK</Text>
          <Text style={styles.title}>Enter your{"\n"}phone number</Text>
          <Text style={styles.sub}>We'll send a 6-digit code to verify your number.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}>
                <Text style={styles.ccText}>+91</Text>
              </View>
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="98765 43210"
                placeholderTextColor={colors.textSubtle}
                keyboardType="phone-pad"
                maxLength={12}
                style={[styles.input, { flex: 1 }]}
                autoFocus
              />
            </View>
          </View>

          {err ? <Text style={styles.err} testID="phone-error">{err}</Text> : null}

          <TouchableOpacity
            testID="send-otp-btn"
            style={[styles.cta, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={submit}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Send OTP</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>Tip: For testing, the OTP is shown on the next screen.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  logoWrap: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginTop: spacing.xl, marginBottom: spacing.md },
  badge: { ...font.caption, color: colors.brandDark, marginBottom: spacing.sm },
  title: { ...font.h1, color: colors.text, marginBottom: spacing.sm, lineHeight: 40 },
  sub: { ...font.body, color: colors.textMuted, marginBottom: spacing.xxl, lineHeight: 22 },
  field: { marginBottom: spacing.lg },
  label: { ...font.small, color: colors.textMuted, marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...font.body, color: colors.text, height: 52 },
  phoneRow: { flexDirection: "row", gap: spacing.sm },
  cc: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, justifyContent: "center" },
  ccText: { ...font.body, color: colors.text, fontWeight: "700" },
  err: { color: colors.danger, ...font.small, marginBottom: spacing.md },
  cta: { backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  ctaText: { color: "#fff", ...font.h3 },
  hint: { ...font.small, color: colors.textSubtle, marginTop: spacing.lg, textAlign: "center" },
});
