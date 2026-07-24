import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Shop } from "@/src/api";

const FILTERS = ["Pending", "Approved", "Suspended", "All"];

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ shops: Shop[] }>("/admin/shops");
      setShops(data.shops);
    } catch { setShops([]); }
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = shops.filter((s) => filter === "All" || s.status === filter.toLowerCase());

  const doAction = async (id: string, action: "approve" | "suspend") => {
    setBusyId(id);
    try {
      await api.patch(`/admin/shops/${id}/${action}`);
      await load();
    } finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Shops</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContainer}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity key={f} testID={`admin-filter-${f.toLowerCase()}`} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.85}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}><Ionicons name="checkmark-circle-outline" size={40} color={colors.textSubtle} /><Text style={styles.emptyText}>No shops in this state.</Text></View>
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={styles.card} testID={`admin-shop-${s.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>{s.category} · {s.address}</Text>
                    <Text style={styles.meta}>Owner: {s.owner_phone || "—"}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: s.status === "approved" ? "#ECFDF5" : s.status === "pending" ? "#FEF3C7" : "#FEF2F2" }]}>
                    <Text style={[styles.badgeText, { color: s.status === "approved" ? colors.brandDark : s.status === "pending" ? "#B45309" : colors.danger }]}>{s.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  {s.status !== "approved" && (
                    <TouchableOpacity testID={`admin-approve-${s.id}`} onPress={() => doAction(s.id, "approve")} disabled={busyId === s.id} style={styles.approve}>
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  {s.status !== "suspended" && (
                    <TouchableOpacity testID={`admin-suspend-${s.id}`} onPress={() => doAction(s.id, "suspend")} disabled={busyId === s.id} style={styles.suspend}>
                      <Text style={styles.suspendText}>Suspend</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  name: { ...font.h3, color: colors.text },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  approve: { flex: 1, height: 42, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  approveText: { color: "#fff", fontWeight: "700" },
  suspend: { flex: 1, height: 42, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: "#FCA5A5", alignItems: "center", justifyContent: "center" },
  suspendText: { color: colors.danger, fontWeight: "700" },
  emptyBox: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { ...font.body, color: colors.textMuted },
});
