import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, signIn } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [locationText, setLocationText] = useState(user?.location?.text ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    user?.location ? { lat: user.location.lat, lng: user.location.lng } : null
  );
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchLocation = async () => {
    setFetchingLoc(true); setErr("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setErr("Location permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const text = [geo?.street, geo?.district, geo?.city, geo?.region].filter(Boolean).join(", ");
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocationText(text);
    } catch {
      setErr("Could not fetch location. Enter manually.");
    } finally {
      setFetchingLoc(false);
    }
  };

  const save = async () => {
    setErr(""); setSuccess(false);
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    try {
      const { data } = await api.put<{ access_token: string; user: any }>("/auth/profile", {
        name: name.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        location_text: locationText || null,
      });
      await signIn(data.access_token, data.user);
      setSuccess(true);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              testID="edit-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ravi Kumar"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <View style={[styles.input, styles.disabledInput]}>
              <Text style={styles.disabledText}>{user?.phone}</Text>
            </View>
            <Text style={styles.hint}>Phone number cannot be changed</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Your location</Text>
            <TouchableOpacity
              style={styles.locBtn}
              onPress={fetchLocation}
              disabled={fetchingLoc}
              activeOpacity={0.8}
            >
              {fetchingLoc
                ? <ActivityIndicator color={colors.brand} size="small" />
                : <Ionicons name="locate" size={20} color={colors.brand} />}
              <Text style={styles.locBtnText}>
                {fetchingLoc ? "Fetching location…" : "Use current location"}
              </Text>
            </TouchableOpacity>

            {locationText && coords ? (
              <View style={styles.locResult}>
                <Ionicons name="location" size={16} color={colors.brand} />
                <Text style={styles.locResultText}>{locationText}</Text>
              </View>
            ) : null}

            <View style={styles.orRow}>
              <View style={styles.orLine} /><Text style={styles.orText}>or enter manually</Text><View style={styles.orLine} />
            </View>
            <TextInput
              value={locationText}
              onChangeText={(t) => { setLocationText(t); setCoords(null); }}
              placeholder="e.g. Koramangala, Bengaluru"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}
          {success ? <Text style={styles.successMsg}>Profile updated!</Text> : null}

          <TouchableOpacity
            testID="save-profile-btn"
            style={[styles.cta, saving && { opacity: 0.7 }]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.ctaText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...font.h3, color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  field: { marginBottom: spacing.lg },
  label: { ...font.small, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: "700" },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, ...font.body, color: colors.text, justifyContent: "center" },
  disabledInput: { backgroundColor: "#F1F5F9" },
  disabledText: { ...font.body, color: colors.textSubtle },
  hint: { ...font.small, color: colors.textSubtle, marginTop: spacing.xs },
  locBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#ECFDF5", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: spacing.sm },
  locBtnText: { ...font.body, color: colors.brand, fontWeight: "600" },
  locResult: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, marginBottom: spacing.sm },
  locResultText: { ...font.small, color: colors.textMuted, flex: 1 },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { ...font.small, color: colors.textSubtle },
  err: { color: colors.danger, ...font.small, marginBottom: spacing.md },
  successMsg: { color: colors.brandDark, ...font.small, fontWeight: "700", marginBottom: spacing.md },
  cta: { backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ctaText: { color: "#fff", ...font.h3 },
});
