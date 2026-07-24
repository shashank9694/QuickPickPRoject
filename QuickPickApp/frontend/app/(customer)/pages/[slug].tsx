import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type StaticPage = { slug: string; title: string; content: string; updated_at?: string };

export default function StaticPageScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const { data } = await api.get<StaticPage>(`/static-pages/${slug}`);
      setPage(data);
    } catch {
      setErr("Page not found");
    }
  }, [slug]);

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
        <Text style={styles.headerTitle} numberOfLines={1}>{page?.title ?? "Loading…"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSubtle} />
          <Text style={styles.errText}>{err}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          <Text style={styles.title}>{page!.title}</Text>
          {page!.updated_at && (
            <Text style={styles.updated}>Last updated: {new Date(page!.updated_at).toLocaleDateString("en-IN")}</Text>
          )}
          <View style={styles.divider} />
          <Text style={styles.content}>{page!.content}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...font.h3, color: colors.text, flex: 1, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  errText: { ...font.body, color: colors.textMuted },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...font.h1, color: colors.text, marginBottom: spacing.xs },
  updated: { ...font.small, color: colors.textSubtle },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  content: { ...font.body, color: colors.text, lineHeight: 26 },
});
