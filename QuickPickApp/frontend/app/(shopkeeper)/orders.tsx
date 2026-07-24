import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius, statusColor, statusLabel } from "@/src/theme";
import { api, Order } from "@/src/api";

const FILTERS = ["All", "submitted", "awaiting_payment", "packaging", "ready", "completed", "cancelled"];
const FILTER_LABELS: Record<string, string> = {
  All: "All",
  submitted: "Placed",
  awaiting_payment: "Awaiting Pay",
  packaging: "Packaging",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function ShopkeeperOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ orders: Order[] }>("/orders/shop");
      setOrders(data.orders);
    } catch { setOrders([]); }
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));

  const filtered = orders.filter((o) => filter === "All" || o.status === filter);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Orders</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContainer}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity key={f} testID={`filter-${f.toLowerCase().replace(/_/g, "-")}`} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.85}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{FILTER_LABELS[f] ?? f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="checkmark-done" size={40} color={colors.textSubtle} /><Text style={styles.emptyText}>No orders in this bucket.</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({ pathname: "/(shopkeeper)/order/[id]", params: { id: item.id } })} testID={`sk-order-card-${item.id}`} style={styles.card} activeOpacity={0.9}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{item.customer_name}</Text>
                <View style={[styles.status, { backgroundColor: statusColor(item.status) + "22" }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.itemsPreview}>{item.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
                <Text style={styles.total}>{item.total > 0 ? `₹${item.total.toFixed(0)}` : "—"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: 0 },
  title: { ...font.h1, color: colors.text },
  chipsRow: { maxHeight: 56, marginTop: spacing.md },
  chipsContainer: { paddingHorizontal: spacing.lg, gap: 8, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...font.small, color: colors.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { ...font.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "800" },
  itemsPreview: { ...font.small, color: colors.textMuted },
  date: { ...font.small, color: colors.textSubtle },
  total: { ...font.body, color: colors.text, fontWeight: "800" },
  emptyBox: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { ...font.body, color: colors.textMuted },
});
