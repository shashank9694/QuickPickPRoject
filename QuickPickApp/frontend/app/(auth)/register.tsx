import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Step = "profile" | "location" | "shop";

const SHOP_CATEGORIES = ["Grocery", "Pharmacy", "Bakery", "Cafe", "Electronics", "Stationery", "Clothing", "Hardware", "Other"];

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Profile step
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "shopkeeper" | "">("");

  // Location step (customers)
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  // Shop step (shopkeepers)
  const [shopName, setShopName] = useState("");
  const [shopCategory, setShopCategory] = useState("Grocery");
  const [shopAddress, setShopAddress] = useState("");
  const [shopLat, setShopLat] = useState<number | null>(null);
  const [shopLng, setShopLng] = useState<number | null>(null);
  const [fetchingShopLoc, setFetchingShopLoc] = useState(false);

  const fetchLocation = async (forShop = false) => {
    const setter = forShop ? setFetchingShopLoc : setFetchingLoc;
    setter(true);
    setErr("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErr("Location permission denied. Please enter manually.");
        setter(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const text = [geo?.street, geo?.district, geo?.city, geo?.region].filter(Boolean).join(", ");
      if (forShop) {
        setShopLat(loc.coords.latitude);
        setShopLng(loc.coords.longitude);
        setShopAddress(text);
      } else {
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setLocationText(text);
      }
    } catch {
      setErr("Could not fetch location. Please enter manually.");
    } finally {
      setter(false);
    }
  };

  const submitProfile = async () => {
    setErr("");
    if (!name.trim()) { setErr("Please enter your name"); return; }
    if (!role) { setErr("Please select your role"); return; }
    if (role === "customer") {
      setStep("location");
    } else {
      setStep("shop");
    }
  };

  const submitCustomer = async () => {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/complete-profile", {
        name: name.trim(),
        role: "customer",
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        location_text: locationText || null,
      });
      await signIn(data.access_token, data.user);
      router.replace("/(customer)/home");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const submitShopkeeper = async () => {
    setErr("");
    if (!shopName.trim()) { setErr("Shop name is required"); return; }
    if (!shopAddress.trim()) { setErr("Shop address / location is required"); return; }
    if (shopLat === null || shopLng === null) { setErr("Please fetch or enter your shop location"); return; }
    setLoading(true);
    try {
      // Complete profile first
      const { data: profileData } = await api.post("/auth/complete-profile", {
        name: name.trim(),
        role: "shopkeeper",
      });
      await signIn(profileData.access_token, profileData.user);
      // Then create first shop
      await api.post("/shops", {
        name: shopName.trim(),
        category: shopCategory,
        description: "",
        address: shopAddress.trim(),
        lat: shopLat,
        lng: shopLng,
      });
      router.replace("/(shopkeeper)/dashboard");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {(["profile", role === "shopkeeper" ? "shop" : "location"] as Step[]).map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === "location" && i === 1) || (step === "shop" && i === 1) ? styles.stepDotActive : null]}>
                  <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{i + 1}</Text>
                </View>
                {i === 0 && <View style={styles.stepLine} />}
              </View>
            ))}
          </View>

          {/* ── STEP 1: Profile ── */}
          {step === "profile" && (
            <>
              <Text style={styles.badge}>CREATE ACCOUNT</Text>
              <Text style={styles.title}>Tell us about{"\n"}yourself</Text>
              <Text style={styles.sub}>This helps us personalise your experience.</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  testID="name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ravi Kumar"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>I am a…</Text>
                <View style={styles.roleRow}>
                  {(["customer", "shopkeeper"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      testID={`role-${r}`}
                      style={[styles.roleCard, role === r && styles.roleCardActive]}
                      onPress={() => setRole(r)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={r === "customer" ? "bag-handle-outline" : "storefront-outline"}
                        size={26}
                        color={role === r ? colors.brand : colors.textMuted}
                      />
                      <Text style={[styles.roleLabel, role === r && styles.roleLabelActive]}>
                        {r === "customer" ? "Customer" : "Shopkeeper"}
                      </Text>
                      <Text style={styles.roleDesc}>
                        {r === "customer" ? "Order from nearby shops" : "Manage your shop & orders"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}

              <TouchableOpacity style={styles.cta} onPress={submitProfile} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2a: Location (Customer) ── */}
          {step === "location" && (
            <>
              <TouchableOpacity onPress={() => { setErr(""); setStep("profile"); }} style={styles.back} hitSlop={12}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.badge}>YOUR LOCATION</Text>
              <Text style={styles.title}>Where are you{"\n"}located?</Text>
              <Text style={styles.sub}>Helps us show nearby shops. You can skip this and update later.</Text>

              <TouchableOpacity
                style={styles.locBtn}
                onPress={() => fetchLocation(false)}
                disabled={fetchingLoc}
                activeOpacity={0.8}
              >
                {fetchingLoc
                  ? <ActivityIndicator color={colors.brand} size="small" />
                  : <Ionicons name="locate" size={20} color={colors.brand} />}
                <Text style={styles.locBtnText}>
                  {fetchingLoc ? "Fetching location…" : "Use my current location"}
                </Text>
              </TouchableOpacity>

              {locationText ? (
                <View style={styles.locResult}>
                  <Ionicons name="location" size={16} color={colors.brand} />
                  <Text style={styles.locResultText}>{locationText}</Text>
                </View>
              ) : null}

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or enter manually</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  value={locationText}
                  onChangeText={(t) => { setLocationText(t); setCoords(null); }}
                  placeholder="e.g. Koramangala, Bengaluru"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}

              <TouchableOpacity
                style={[styles.cta, loading && { opacity: 0.7 }]}
                onPress={submitCustomer}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.ctaText}>Complete Setup</Text>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={submitCustomer} style={styles.skip}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2b: First Shop (Shopkeeper) ── */}
          {step === "shop" && (
            <>
              <TouchableOpacity onPress={() => { setErr(""); setStep("profile"); }} style={styles.back} hitSlop={12}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.badge}>ADD YOUR SHOP</Text>
              <Text style={styles.title}>Set up your{"\n"}first shop</Text>
              <Text style={styles.sub}>You need at least one shop to start receiving orders.</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Shop name *</Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="e.g. Ravi General Store"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                  {SHOP_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catChip, shopCategory === cat && styles.catChipActive]}
                      onPress={() => setShopCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.catText, shopCategory === cat && styles.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Shop location *</Text>
                <TouchableOpacity
                  style={styles.locBtn}
                  onPress={() => fetchLocation(true)}
                  disabled={fetchingShopLoc}
                  activeOpacity={0.8}
                >
                  {fetchingShopLoc
                    ? <ActivityIndicator color={colors.brand} size="small" />
                    : <Ionicons name="locate" size={20} color={colors.brand} />}
                  <Text style={styles.locBtnText}>
                    {fetchingShopLoc ? "Fetching location…" : "Use current location"}
                  </Text>
                </TouchableOpacity>

                {shopAddress ? (
                  <View style={[styles.locResult, { marginTop: spacing.sm }]}>
                    <Ionicons name="location" size={16} color={colors.brand} />
                    <Text style={styles.locResultText}>{shopAddress}</Text>
                  </View>
                ) : null}

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or enter manually</Text>
                  <View style={styles.orLine} />
                </View>

                <TextInput
                  value={shopAddress}
                  onChangeText={(t) => { setShopAddress(t); setShopLat(null); setShopLng(null); }}
                  placeholder="Full shop address"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}

              <TouchableOpacity
                style={[styles.cta, loading && { opacity: 0.7 }]}
                onPress={submitShopkeeper}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.ctaText}>Create Shop & Continue</Text>
                    <Ionicons name="storefront" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.footer}>By continuing you agree to QuickPick's Terms & Privacy.</Text>
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
  title: { ...font.h1, color: colors.text, marginBottom: spacing.sm, lineHeight: 38 },
  sub: { ...font.body, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 22 },
  field: { marginBottom: spacing.lg },
  label: { ...font.small, color: colors.textMuted, marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...font.body, color: colors.text, height: 52 },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, alignItems: "center", gap: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  roleCardActive: { borderColor: colors.brand, backgroundColor: "#ECFDF5" },
  roleLabel: { ...font.h3, color: colors.textMuted },
  roleLabelActive: { color: colors.brand },
  roleDesc: { ...font.small, color: colors.textSubtle, textAlign: "center", lineHeight: 16 },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.sm },
  stepItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepNum: { ...font.small, color: colors.textMuted, fontWeight: "700" },
  stepNumActive: { color: "#fff" },
  stepLine: { flex: 1, height: 1.5, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  locBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#ECFDF5", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#A7F3D0" },
  locBtnText: { ...font.body, color: colors.brand, fontWeight: "600" },
  locResult: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  locResultText: { ...font.small, color: colors.textMuted, flex: 1 },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { ...font.small, color: colors.textSubtle },
  catScroll: { marginBottom: spacing.sm },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catText: { ...font.small, color: colors.textMuted },
  catTextActive: { color: "#fff", fontWeight: "600" },
  err: { color: colors.danger, ...font.small, marginBottom: spacing.md },
  cta: { backgroundColor: colors.brand, height: 56, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  ctaText: { color: "#fff", ...font.h3 },
  skip: { alignItems: "center", marginTop: spacing.md },
  skipText: { ...font.small, color: colors.textSubtle, textDecorationLine: "underline" },
  footer: { ...font.small, color: colors.textSubtle, textAlign: "center", marginTop: spacing.xl },
});
