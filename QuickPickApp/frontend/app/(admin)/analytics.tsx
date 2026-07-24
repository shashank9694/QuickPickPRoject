import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type Analytics = {
  total_orders: number;
  completed_orders: number;
  active_shops: number;
  pending_shops: number;
  total_users: number;
  customers: number;
  shopkeepers: number;
  revenue: number;
};

export default function AdminAnalytics() {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get<Analytics>("/admin/analytics"); setA(data); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading || !a) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  const rate = a.total_orders > 0 ? Math.round((a.completed_orders / a.total_orders) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Platform-wide health & activity</Text>

        <View style={styles.grid}>
          <Metric testID="a-orders" icon="receipt" label="Total Orders" value={String(a.total_orders)} color={colors.submitted} />
          <Metric testID="a-completed" icon="checkmark-circle" label="Completed" value={String(a.completed_orders)} color={colors.brand} />
          <Metric testID="a-rate" icon="trending-up" label="Completion" value={`${rate}%`} color={colors.accent} />
          <Metric testID="a-revenue" icon="cash" label="Revenue" value={`₹${a.revenue.toFixed(0)}`} color={colors.brandDark} />
          <Metric testID="a-shops" icon="storefront" label="Active Shops" value={String(a.active_shops)} color={colors.submitted} />
          <Metric testID="a-pending" icon="hourglass" label="Pending Shops" value={String(a.pending_shops)} color={colors.packaging} />
          <Metric testID="a-customers" icon="people" label="Customers" value={String(a.customers)} color={colors.brand} />
          <Metric testID="a-shopkeepers" icon="briefcase" label="Shopkeepers" value={String(a.shopkeepers)} color={colors.accent} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ testID, icon, label, value, color }: any) {
  return (
    <View style={styles.metric} testID={testID}>
      <View style={[styles.icon, { backgroundColor: color + "22" }]}><Ionicons name={icon} size={18} color={color} /></View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  value: { ...font.h2, color: colors.text },
  label: { ...font.small, color: colors.textMuted },
});
