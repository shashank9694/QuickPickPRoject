import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type U = { id: string; phone: string; name: string; role: string; created_at: string };

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ users: U[] }>("/admin/users");
      setUsers(data.users);
    } catch { setUsers([]); }
  }, []);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Users</Text><Text style={styles.sub}>{users.length} total</Text></View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brand} /></View> : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`user-${item.id}`}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || "U").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
              </View>
              <View style={[styles.roleBadge, item.role === "admin" ? { backgroundColor: "#FEF3C7" } : item.role === "shopkeeper" ? { backgroundColor: "#DBEAFE" } : { backgroundColor: "#ECFDF5" }]}>
                <Text style={[styles.roleText, item.role === "admin" ? { color: "#B45309" } : item.role === "shopkeeper" ? { color: "#1E40AF" } : { color: colors.brandDark }]}>{item.role.toUpperCase()}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },
  name: { ...font.body, color: colors.text, fontWeight: "700" },
  phone: { ...font.small, color: colors.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  roleText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});
