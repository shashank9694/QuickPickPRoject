import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius, statusColor, statusLabel } from "@/src/theme";
import { api, Order } from "@/src/api";

type NotifItem = {
  id: string;
  orderId: string;
  shopName: string;
  status: Order["status"];
  time: string;
};

function ordersToNotifs(orders: Order[]): NotifItem[] {
  return orders.map((o) => ({
    id: o.id,
    orderId: o.id,
    shopName: o.shop_name,
    status: o.status,
    time: o.updated_at,
  })).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

const STATUS_MESSAGES: Record<string, string> = {
  submitted: "Your order was placed",
  awaiting_payment: "Shopkeeper reviewed your order — payment required",
  packaging: "Payment confirmed — order is being packed",
  ready: "Order is ready for pickup! Show your OTP",
  completed: "Order picked up successfully",
  cancelled: "Order was cancelled",
};

const STATUS_ICONS: Record<string, string> = {
  submitted: "receipt-outline",
  awaiting_payment: "card-outline",
  packaging: "cube-outline",
  ready: "storefront-outline",
  completed: "checkmark-circle",
  cancelled: "close-circle-outline",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ orders: Order[] }>("/orders/mine");
      setNotifs(ordersToNotifs(data.orders));
    } catch { setNotifs([]); }
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySub}>Order updates will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = statusColor(item.status);
            const icon = STATUS_ICONS[item.status] ?? "information-circle-outline";
            const msg = STATUS_MESSAGES[item.status] ?? statusLabel(item.status);
            const isCompleted = item.status === "completed";
            const isCancelled = item.status === "cancelled";

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(customer)/order/[id]", params: { id: item.orderId } })}
              >
                <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
                  <Ionicons name={icon as any} size={22} color={color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.shopName} numberOfLines={1}>{item.shopName}</Text>
                  <Text style={[styles.message, (isCompleted || isCancelled) && { color: colors.textSubtle }]}>{msg}</Text>
                  <Text style={styles.time}>{new Date(item.time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...font.h3, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 80, alignItems: "center", gap: spacing.sm },
  emptyText: { ...font.h3, color: colors.textMuted },
  emptySub: { ...font.small, color: colors.textSubtle },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  iconBox: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 2 },
  shopName: { ...font.body, color: colors.text, fontWeight: "700" },
  message: { ...font.small, color: colors.textMuted, lineHeight: 18 },
  time: { ...font.small, color: colors.textSubtle, fontSize: 11, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
