import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Order, Plan, Shop, Subscription } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sub, setSub] = useState<{ subscription: Subscription; plan: Plan } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, o, m] = await Promise.all([
        api.get<{ shops: Shop[] }>("/shops/mine/list"),
        api.get<{ orders: Order[] }>("/orders/shop"),
        api.get<{ subscription: Subscription; plan: Plan }>("/subscription/mine"),
      ]);
      setShops(s.data.shops);
      setOrders(o.data.orders);
      setSub(m.data);
    } catch {
      setShops([]); setOrders([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleOpen = async (shopId: string) => {
    try {
      await api.patch(`/shops/${shopId}/toggle-open`);
      await load();
    } catch {}
  };

  const today = new Date().toDateString();
  const todaysOrders = orders.filter((o) => new Date(o.created_at).toDateString() === today);
  const revenue = todaysOrders.filter((o) => o.status === "completed").reduce((a, b) => a + b.total, 0);
  const active = orders.filter((o) => ["submitted", "awaiting_payment", "packaging"].includes(o.status)).length;
  const ready = orders.filter((o) => o.status === "ready").length;

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <Text style={styles.hi}>Namaste, {user?.name?.split(" ")[0]} 🙏</Text>
        <Text style={styles.sub}>Here&apos;s your shop status</Text>

        {sub ? (
          <TouchableOpacity
            testID="sub-banner"
            style={styles.subBanner}
            activeOpacity={0.9}
            onPress={() => router.push("/(shopkeeper)/subscription")}
          >
            <View style={styles.subIcon}>
              <Ionicons name={sub.plan.code === "free_trial" ? "gift" : "sparkles"} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>{sub.plan.name}{sub.plan.code === "free_trial" ? " · Free Trial" : ""}</Text>
              <Text style={styles.subDesc}>
                {Math.max(0, Math.ceil((new Date(sub.subscription.expires_at).getTime() - Date.now()) / 86400000))} days left · Tap to {sub.plan.code === "free_trial" || sub.plan.code === "starter" ? "upgrade" : "manage"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard testID="stat-active" icon="hourglass" label="Active" value={String(active)} color={colors.packaging} />
          <StatCard testID="stat-ready" icon="checkmark-circle" label="Ready" value={String(ready)} color={colors.ready} />
          <StatCard testID="stat-today" icon="receipt" label="Today" value={String(todaysOrders.length)} color={colors.submitted} />
          <StatCard testID="stat-revenue" icon="cash" label="Revenue" value={`₹${revenue.toFixed(0)}`} color={colors.brand} />
        </View>

        <Text style={styles.section}>My Shops</Text>
        {shops.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="storefront-outline" size={40} color={colors.textSubtle} />
            <Text style={styles.emptyText}>You haven&apos;t added a shop yet.</Text>
            <TouchableOpacity testID="add-shop-btn" onPress={() => router.push("/(shopkeeper)/shop")} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add Shop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shops.map((s) => (
            <View key={s.id} style={styles.shopCard} testID={`shop-manage-${s.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName}>{s.name}</Text>
                <Text style={styles.shopMeta}>{s.category} · {s.status.toUpperCase()}</Text>
              </View>
              <TouchableOpacity
                testID={`toggle-open-${s.id}`}
                onPress={() => toggleOpen(s.id)}
                style={[styles.toggle, s.is_open && styles.toggleOn]}
                activeOpacity={0.85}
              >
                <Text style={[styles.toggleText, s.is_open && { color: "#fff" }]}>{s.is_open ? "OPEN" : "CLOSED"}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.section}>Recent Orders</Text>
        {orders.slice(0, 5).map((o) => (
          <TouchableOpacity
            key={o.id}
            testID={`sk-order-${o.id}`}
            onPress={() => router.push({ pathname: "/(shopkeeper)/order/[id]", params: { id: o.id } })}
            style={styles.orderRow}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orderName}>{o.customer_name}</Text>
              <Text style={styles.orderMeta}>{o.items.length} items · {new Date(o.created_at).toLocaleTimeString()}</Text>
            </View>
            <Text style={[styles.orderStatus, { color: colors.brandDark }]}>{o.status.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ testID, icon, label, value, color }: any) {
  return (
    <View style={styles.stat} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hi: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  subBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg, backgroundColor: colors.brandDark, padding: spacing.md, borderRadius: radius.lg },
  subIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: "#065F46", alignItems: "center", justifyContent: "center" },
  subTitle: { color: "#fff", ...font.body, fontWeight: "800" },
  subDesc: { color: "#A7F3D0", ...font.small, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  stat: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  statValue: { ...font.h2, color: colors.text },
  statLabel: { ...font.small, color: colors.textMuted },
  section: { ...font.h3, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  emptyBox: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  emptyText: { ...font.body, color: colors.textMuted },
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700" },
  shopCard: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  shopName: { ...font.body, color: colors.text, fontWeight: "700" },
  shopMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  toggle: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  toggleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  toggleText: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5 },
  orderRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  orderName: { ...font.body, color: colors.text, fontWeight: "700" },
  orderMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  orderStatus: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});
