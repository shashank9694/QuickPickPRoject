import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const doSignOut = async () => {
    await signOut();
    router.replace("/(auth)/phone");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || "U").charAt(0).toUpperCase()}</Text>
            </View>
            <TouchableOpacity
              testID="edit-profile-btn"
              style={styles.editBtn}
              onPress={() => router.push("/(customer)/edit-profile")}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text></View>
        </View>

        <View style={styles.section}>
          <RowItem icon="notifications" label="Notifications" onPress={() => router.push("/(customer)/notifications")} />
          <RowItem icon="information-circle" label="About QuickPick" onPress={() => router.push({ pathname: "/(customer)/pages/[slug]", params: { slug: "about" } })} />
          <RowItem icon="document-text" label="Terms of Service" onPress={() => router.push({ pathname: "/(customer)/pages/[slug]", params: { slug: "terms" } })} />
          <RowItem icon="shield-checkmark" label="Privacy Policy" onPress={() => router.push({ pathname: "/(customer)/pages/[slug]", params: { slug: "privacy" } })} last />
        </View>

        <TouchableOpacity testID="signout-btn" onPress={doSignOut} style={styles.signout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>QuickPick v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({ icon, label, onPress, last }: { icon: any; label: string; onPress?: () => void; last?: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={[styles.row, last && { borderBottomWidth: 0 }]} onPress={onPress}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.brand} /></View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  avatarWrap: { position: "relative", marginBottom: spacing.sm },
  avatar: { width: 84, height: 84, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  editBtn: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.brandDark, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  name: { ...font.h2, color: colors.text },
  phone: { ...font.small, color: colors.textMuted },
  badge: { marginTop: spacing.sm, paddingHorizontal: 12, height: 24, borderRadius: radius.pill, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.brandDark, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  section: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginTop: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, ...font.body, color: colors.text },
  signout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: "#FCA5A5", padding: spacing.md, borderRadius: radius.pill },
  signoutText: { color: colors.danger, fontWeight: "700" },
  version: { textAlign: "center", ...font.small, color: colors.textSubtle, marginTop: spacing.xl },
});
