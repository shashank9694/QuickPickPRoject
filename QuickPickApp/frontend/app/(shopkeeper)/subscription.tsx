import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Plan, Subscription } from "@/src/api";

export default function SubscriptionScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ subscription: Subscription; plan: Plan } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        api.get<{ plans: Plan[] }>("/subscription/plans"),
        api.get<{ subscription: Subscription; plan: Plan }>("/subscription/mine"),
      ]);
      setPlans(p.data.plans);
      setCurrent(m.data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const subscribe = async (code: string) => {
    setSubscribing(code);
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1600));
    try {
      await api.post("/subscription/subscribe", { plan: code });
      setMsg("Subscription active! (Mock payment succeeded)");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Failed");
    } finally {
      setSubscribing(null);
      setProcessing(false);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  if (loading || !current) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const daysLeft = Math.max(0, Math.ceil((new Date(current.subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="sub-back-btn" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <View style={styles.currentCard} testID="current-plan-card">
          <Text style={styles.currentBadge}>CURRENT PLAN</Text>
          <Text style={styles.currentName}>{current.plan.name}</Text>
          <Text style={styles.currentDesc}>{current.subscription.status.toUpperCase()} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left</Text>
          <View style={styles.currentMetaRow}>
            <View style={styles.currentMeta}><Text style={styles.currentMetaLabel}>Max Orders/day</Text><Text style={styles.currentMetaValue}>{current.plan.max_orders_per_day === 9999 ? "∞" : current.plan.max_orders_per_day}</Text></View>
            <View style={styles.currentMeta}><Text style={styles.currentMetaLabel}>Max Shops</Text><Text style={styles.currentMetaValue}>{current.plan.max_shops}</Text></View>
          </View>
        </View>

        {msg ? <Text style={[styles.msg, msg.includes("succeeded") ? { color: colors.brandDark } : { color: colors.danger }]}>{msg}</Text> : null}

        <Text style={styles.section}>All plans</Text>
        {plans.map((p) => {
          const isCurrent = current.plan.code === p.code;
          const isPaid = p.code !== "free_trial";
          return (
            <View key={p.code} style={[styles.planCard, isCurrent && styles.planCardActive]} testID={`plan-${p.code}`}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {isCurrent && <View style={styles.pill}><Text style={styles.pillText}>ACTIVE</Text></View>}
                </View>
                <Text style={styles.planPrice}>{p.price === 0 ? "Free" : `₹${p.price}/mo`}</Text>
                <View style={styles.features}>
                  {p.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.brand} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                {isPaid && !isCurrent && (
                  <TouchableOpacity
                    testID={`subscribe-${p.code}`}
                    onPress={() => subscribe(p.code)}
                    disabled={!!subscribing}
                    style={[styles.subscribeBtn, !!subscribing && { opacity: 0.5 }]}
                  >
                    {subscribing === p.code ? <ActivityIndicator color="#fff" /> : <Text style={styles.subscribeText}>Subscribe · ₹{p.price}</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <Text style={styles.footer}>Mock payment gateway — swap for Stripe/Razorpay anytime. Zero transaction cut from you.</Text>
      </ScrollView>

      <Modal transparent visible={processing} animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.modalTitle}>Processing subscription…</Text>
            <Text style={styles.modalSub}>Mock gateway — simulating card charge</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { ...font.h3, color: colors.text },
  currentCard: { backgroundColor: colors.brandDark, borderRadius: radius.xl, padding: spacing.xl, gap: 4 },
  currentBadge: { color: "#ECFDF5", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  currentName: { color: "#fff", ...font.h1, marginTop: spacing.sm },
  currentDesc: { color: "#ECFDF5", ...font.small, marginTop: 2 },
  currentMetaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  currentMeta: { flex: 1, backgroundColor: "#065F46", padding: spacing.md, borderRadius: radius.md },
  currentMetaLabel: { color: "#A7F3D0", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  currentMetaValue: { color: "#fff", ...font.h2, marginTop: 2 },
  msg: { ...font.body, fontWeight: "700", textAlign: "center", marginTop: spacing.md },
  section: { ...font.h3, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  planCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  planCardActive: { borderColor: colors.brand, borderWidth: 2 },
  planName: { ...font.h2, color: colors.text },
  planPrice: { ...font.h3, color: colors.brand, marginTop: 4 },
  pill: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, height: 22, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pillText: { color: colors.brandDark, fontSize: 10, fontWeight: "800" },
  features: { marginTop: spacing.md, gap: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { ...font.body, color: colors.textMuted },
  subscribeBtn: { backgroundColor: colors.brand, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  subscribeText: { color: "#fff", ...font.body, fontWeight: "800" },
  footer: { ...font.small, color: colors.textSubtle, textAlign: "center", marginTop: spacing.lg },
  modalBg: { flex: 1, backgroundColor: "#0F172A99", alignItems: "center", justifyContent: "center" },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.md, minWidth: 260 },
  modalTitle: { ...font.h3, color: colors.text },
  modalSub: { ...font.small, color: colors.textMuted },
});
