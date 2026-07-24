import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Subscription } from "@/src/api";

export default function AdminSubs() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [byPlan, setByPlan] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ subscriptions: Subscription[]; revenue: number; by_plan: Record<string, number> }>("/admin/subscriptions");
      setSubs(data.subscriptions);
      setRevenue(data.revenue);
      setByPlan(data.by_plan);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Subscriptions</Text><Text style={styles.sub}>{subs.length} total</Text></View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <View style={styles.revenueCard} testID="sub-revenue-card">
          <Text style={styles.revenueLabel}>MRR (Mock)</Text>
          <Text style={styles.revenueValue}>₹{revenue.toFixed(0)}</Text>
          <View style={styles.byPlanRow}>
            {Object.entries(byPlan).map(([code, count]) => (
              <View key={code} style={styles.byPlanChip} testID={`plan-count-${code}`}>
                <Text style={styles.byPlanCode}>{code.replace("_", " ").toUpperCase()}</Text>
                <Text style={styles.byPlanCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.section}>All subscriptions</Text>
        {subs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={40} color={colors.textSubtle} />
            <Text style={styles.emptyText}>No subscriptions yet.</Text>
          </View>
        ) : subs.map((s) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          return (
            <View key={s.id} style={styles.card} testID={`sub-${s.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.phone}>{s.shopkeeper_phone}</Text>
                <Text style={styles.meta}>{s.plan.replace("_", " ").toUpperCase()} · {s.status.toUpperCase()} · {daysLeft}d left</Text>
                <Text style={styles.txn}>{s.mock_txn_id}</Text>
              </View>
              <Text style={styles.amount}>₹{s.amount_paid}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  revenueCard: { backgroundColor: colors.brandDark, borderRadius: radius.xl, padding: spacing.xl, gap: 4 },
  revenueLabel: { color: "#A7F3D0", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  revenueValue: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: 4 },
  byPlanRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  byPlanChip: { backgroundColor: "#065F46", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  byPlanCode: { color: "#A7F3D0", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  byPlanCount: { color: "#fff", ...font.h3, marginTop: 2 },
  section: { ...font.h3, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  phone: { ...font.body, color: colors.text, fontWeight: "700" },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  txn: { ...font.small, color: colors.textSubtle, marginTop: 2, fontVariant: ["tabular-nums"] as any },
  amount: { ...font.h3, color: colors.brandDark },
  emptyBox: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { ...font.body, color: colors.textMuted },
});
