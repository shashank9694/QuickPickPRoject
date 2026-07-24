import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius, statusColor, statusLabel } from "@/src/theme";
import { api, Order } from "@/src/api";

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ orders: Order[] }>("/orders/mine");
      setOrders(data.orders);
    } catch {
      setOrders([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.sub}>{orders.length} order{orders.length === 1 ? "" : "s"}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={40} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No orders yet.</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/home")} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Browse shops</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`order-card-${item.id}`}
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => router.push({ pathname: "/(customer)/order/[id]", params: { id: item.id } })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.shop} numberOfLines={1}>{item.shop_name}</Text>
                <View style={[styles.status, { backgroundColor: statusColor(item.status) + "22" }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.itemsPreview} numberOfLines={1}>{item.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
                <Text style={styles.total}>{item.total > 0 ? `₹${item.total.toFixed(0)}` : "Awaiting total"}</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shop: { ...font.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  itemsPreview: { ...font.small, color: colors.textMuted },
  date: { ...font.small, color: colors.textSubtle },
  total: { ...font.body, color: colors.text, fontWeight: "800" },
  emptyBox: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { ...font.body, color: colors.textMuted },
  emptyBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
});
