import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Shop } from "@/src/api";
import { useAuth } from "@/src/auth";

const CATEGORIES = ["All", "Grocery", "Bakery", "Pharmacy", "Cafe"];
const DEFAULT_COORDS = { lat: 12.9716, lng: 77.5946 };

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.skeletonImg} />
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={[styles.skeletonLine, { width: "60%" }]} />
        <View style={[styles.skeletonLine, { width: "40%", height: 12 }]} />
        <View style={[styles.skeletonLine, { width: "80%", height: 12, marginTop: 4 }]} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [coordsLabel, setCoordsLabel] = useState("Using default location");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [cat, setCat] = useState("All");

  // Debounce search input — wait 300ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      let s = status;
      if (s !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        s = req.status;
      }
      if (s === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoordsLabel("Near your location");
        return { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
    } catch {
      // fall through to default
    }
    setCoordsLabel("Using default location · enable GPS for nearby");
    return DEFAULT_COORDS;
  }, []);

  // Stable fetch function — no closure deps, all params explicit
  const loadShops = useCallback(async (
    c: { lat: number; lng: number },
    query: string,
    category: string,
  ) => {
    try {
      const { data } = await api.get<{ shops: Shop[] }>("/shops/nearby", {
        params: { lat: c.lat, lng: c.lng, q: query, category: category === "All" ? "" : category },
      });
      setShops(data.shops);
    } catch {
      setShops([]);
    }
  }, []);

  // Track whether the initial fetch has already been fired
  const didInitRef = useRef(false);

  // Single effect drives all fetches.
  // On mount (didInitRef.current = false): fetch immediately with default coords,
  // get GPS in parallel — no 3-7s wait. Subsequent fires reload with current params.
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      setLoading(true);
      loadShops(DEFAULT_COORDS, debouncedQ, cat).finally(() => setLoading(false));
      // GPS in background — updates coords if better location available
      fetchLocation().then((gpsCoords) => {
        if (gpsCoords.lat !== DEFAULT_COORDS.lat || gpsCoords.lng !== DEFAULT_COORDS.lng) {
          setCoords(gpsCoords); // triggers this effect again for a precision refresh
        }
      });
    } else {
      loadShops(coords, debouncedQ, cat);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, cat, coords]);

  const onRefresh = async () => {
    setRefreshing(true);
    const c = await fetchLocation();
    setCoords(c);
    await loadShops(c, q, cat);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hi, {user?.name?.split(" ")[0] || "there"} 👋</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={colors.brandDark} />
            <Text style={styles.locText}>{coordsLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput
          testID="search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Search shops by name..."
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={styles.chipsContainer}
      >
        {CATEGORIES.map((c) => {
          const active = c === cat;
          return (
            <TouchableOpacity
              key={c}
              testID={`cat-chip-${c.toLowerCase()}`}
              onPress={() => setCat(c)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl }}
          scrollEnabled={false}
        >
          {[1, 2, 3].map((k) => (
            <View key={k}>
              <SkeletonCard />
              {k < 3 && <View style={{ height: spacing.md }} />}
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={40} color={colors.textSubtle} />
              <Text style={styles.emptyText}>{q || cat !== "All" ? "No shops match your search." : "No shops within 50 km of your location."}</Text>
              <Text style={styles.emptyHint}>Pull down to refresh or check your GPS</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`shop-card-${item.id}`}
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => router.push({ pathname: "/(customer)/shop/[id]", params: { id: item.id } })}
            >
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.cardImg} />
              ) : (
                <View style={styles.cardImg} />
              )}
              <View style={styles.cardBody}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.badge, item.is_open ? styles.badgeOpen : styles.badgeClosed]}>
                    <Text style={[styles.badgeText, { color: item.is_open ? colors.brandDark : colors.danger }]}>{item.is_open ? "OPEN" : "CLOSED"}</Text>
                  </View>
                </View>
                <Text style={styles.cardCat}>{item.category} · {item.hours}</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.distBadge}>
                    <Ionicons name="navigate" size={13} color={colors.brandDark} />
                    <Text style={styles.distText}>{item.distance_km != null ? (item.distance_km < 1 ? `${(item.distance_km * 1000).toFixed(0)} m away` : `${item.distance_km.toFixed(1)} km away`) : "—"}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.metaText}>{item.rating}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time" size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>~{item.avg_pack_time_min} min</Text>
                  </View>
                </View>
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
  hi: { ...font.h2, color: colors.text },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  locText: { ...font.small, color: colors.textMuted },
  searchWrap: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, ...font.body, height: 48 },
  chipsRow: { maxHeight: 56, marginTop: spacing.md },
  chipsContainer: { paddingHorizontal: spacing.lg, gap: 8, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...font.small, color: colors.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  skeletonImg: { width: "100%", height: 150, backgroundColor: "#E2E8F0" },
  skeletonLine: { height: 16, backgroundColor: "#E2E8F0", borderRadius: radius.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  cardImg: { width: "100%", height: 150, backgroundColor: "#E2E8F0" },
  cardBody: { padding: spacing.lg, gap: 4 },
  cardTitle: { ...font.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardCat: { ...font.small, color: colors.textMuted },
  cardAddr: { ...font.small, color: colors.textSubtle },
  badge: { paddingHorizontal: 10, height: 22, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  badgeOpen: { backgroundColor: "#ECFDF5" },
  badgeClosed: { backgroundColor: "#FEF2F2" },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...font.small, color: colors.textMuted },
  emptyBox: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.sm },
  emptyText: { ...font.body, color: colors.textMuted, textAlign: "center" },
  emptyHint: { ...font.small, color: colors.textSubtle, textAlign: "center" },
  distBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  distText: { ...font.small, color: colors.brandDark, fontWeight: "700" },
});
