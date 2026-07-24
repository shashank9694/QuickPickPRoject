import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, CatalogItem, Shop } from "@/src/api";
import { VoiceOrderButton, ParsedItem } from "@/src/components/VoiceOrderButton";
import { PhotoListButton } from "@/src/components/PhotoListButton";
import { ShopMapModal } from "@/src/components/ShopMapModal";

type FreeRow = { name: string; qty: number; note: string; photo_url?: string };
type Cart = Record<string, number>; // catalog_item_id -> qty

export default function ShopDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [freeRows, setFreeRows] = useState<FreeRow[]>([]);
  const [payment, setPayment] = useState<"cod" | "upi" | "online">("cod");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [payProcessing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([
          api.get<Shop>(`/shops/${id}`),
          api.get<{ items: CatalogItem[] }>(`/shops/${id}/catalog`),
        ]);
        setShop(s.data);
        setCatalog(c.data.items);
      } catch { setErr("Shop not found"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogItem[]> = {};
    for (const it of catalog) {
      const k = it.category || "Other";
      (g[k] ||= []).push(it);
    }
    return g;
  }, [catalog]);

  const inc = (cid: string) => setCart((p) => ({ ...p, [cid]: (p[cid] || 0) + 1 }));
  const dec = (cid: string) => setCart((p) => {
    const q = (p[cid] || 0) - 1;
    const n = { ...p };
    if (q <= 0) delete n[cid]; else n[cid] = q;
    return n;
  });

  const cartLines = useMemo(() =>
    Object.entries(cart).map(([cid, qty]) => {
      const item = catalog.find((c) => c.id === cid);
      return item ? { item, qty } : null;
    }).filter(Boolean) as { item: CatalogItem; qty: number }[]
  , [cart, catalog]);

  const validFreeRows = freeRows.filter((r) => r.name.trim());
  const cartCount = cartLines.reduce((a, b) => a + b.qty, 0) + validFreeRows.length;
  const catalogTotal = cartLines.reduce((a, b) => a + b.item.price * b.qty, 0);
  const canSubmit = cartCount > 0;

  const addFreeRow = () => setFreeRows((p) => [...p, { name: "", qty: 1, note: "" }]);
  const setFree = (i: number, patch: Partial<FreeRow>) => setFreeRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const delFree = (i: number) => setFreeRows((p) => p.filter((_, idx) => idx !== i));
  const addAiItems = (items: ParsedItem[]) =>
    setFreeRows((p) => [...p, ...items.map((it) => ({ name: it.unit ? `${it.name} (${it.unit})` : it.name, qty: Math.max(1, it.qty || 1), note: "", photo_url: it.photo_url || "" }))]);

  const submit = async () => {
    setErr("");
    if (!canSubmit) { setErr("Add at least one item to your list"); return; }
    setSubmitting(true);
    try {
      const items = [
        ...cartLines.map((l) => ({ name: l.item.name, qty: l.qty, note: "", price: l.item.price, catalog_item_id: l.item.id })),
        ...validFreeRows.map((r) => ({ name: r.name.trim(), qty: Math.max(1, r.qty), note: r.note })),
      ];
      const { data } = await api.post("/orders", { shop_id: id, items, payment_method: payment, notes, pickup_time: "ASAP" });
      router.replace({ pathname: "/(customer)/order/[id]", params: { id: data.id } });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to place order");
    } finally { setSubmitting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!shop) return <View style={styles.center}><Text>{err}</Text></View>;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <View>
            <Image source={{ uri: shop.photo_url }} style={styles.hero} />
            <TouchableOpacity testID="shop-back-btn" onPress={() => router.back()} style={styles.headBack} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{shop.name}</Text>
            <Text style={styles.cat}>{shop.category} · {shop.hours}</Text>
            <Text style={styles.addr}>{shop.address}</Text>
            <View style={styles.metaRow}>
              <MetaChip icon="star" text={`${shop.rating}`} color="#F59E0B" />
              <MetaChip icon="navigate" text={shop.distance_km != null ? `${shop.distance_km} km` : "—"} color={colors.brandDark} />
              <MetaChip icon="time" text={`~${shop.avg_pack_time_min} min`} color={colors.textMuted} />
            </View>
            <TouchableOpacity onPress={() => setMapOpen(true)} style={styles.mapBtn} activeOpacity={0.85}>
              <Ionicons name="map" size={15} color={colors.brand} />
              <Text style={styles.mapBtnText}>View on map</Text>
              {shop.distance_km != null ? (
                <Text style={styles.mapBtnDist}>· {shop.distance_km < 1 ? `${(shop.distance_km * 1000).toFixed(0)} m` : `${shop.distance_km.toFixed(1)} km`}</Text>
              ) : null}
              <Ionicons name="chevron-forward" size={14} color={colors.brand} />
            </TouchableOpacity>

            {!shop.is_open ? <View style={styles.closedBanner}><Text style={styles.closedText}>Shop is currently closed.</Text></View> : null}

            {shop && <ShopMapModal visible={mapOpen} shop={shop} onClose={() => setMapOpen(false)} />}

            {catalog.length > 0 ? (
              <>
                <Text style={styles.section}>Menu</Text>
                <Text style={styles.sub}>Tap + to add items to your list.</Text>
                {Object.entries(grouped).map(([cat, items]) => (
                  <View key={cat} style={{ marginBottom: spacing.md }}>
                    <Text style={styles.catHeading}>{cat.toUpperCase()}</Text>
                    {items.map((it) => {
                      const qty = cart[it.id] || 0;
                      const disabled = !it.in_stock;
                      return (
                        <View key={it.id} style={[styles.itemCard, disabled && { opacity: 0.5 }]} testID={`catalog-${it.id}`}>
                          {it.photo_url
                            ? <Image source={{ uri: it.photo_url }} style={styles.itemThumb} />
                            : <View style={styles.itemThumbEmpty}><Ionicons name="image-outline" size={20} color={colors.textSubtle} /></View>}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{it.name}</Text>
                            <Text style={styles.itemMeta}>{it.unit || ""}</Text>
                            <Text style={styles.itemPrice}>₹{it.price.toFixed(0)}</Text>
                          </View>
                          {disabled ? <Text style={styles.oosLabel}>Out of stock</Text> : qty === 0 ? (
                            <TouchableOpacity testID={`add-${it.id}`} onPress={() => inc(it.id)} style={styles.addBtn} activeOpacity={0.85}>
                              <Ionicons name="add" size={18} color="#fff" />
                              <Text style={styles.addBtnText}>Add</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.qtyRow}>
                              <TouchableOpacity testID={`dec-${it.id}`} onPress={() => dec(it.id)} style={styles.qtyBtn}><Text style={styles.qtyBtnT}>−</Text></TouchableOpacity>
                              <Text style={styles.qtyText}>{qty}</Text>
                              <TouchableOpacity testID={`inc-${it.id}`} onPress={() => inc(it.id)} style={styles.qtyBtn}><Text style={styles.qtyBtnT}>+</Text></TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : null}

            <Text style={styles.section}>{catalog.length ? "Anything else? (free text)" : "Your list"}</Text>
            <Text style={styles.sub}>{catalog.length ? "Add items not in the menu — shopkeeper sets the price." : "Type each item you need. Shopkeeper will pack and set the total."}</Text>

            {freeRows.map((r, i) => (
              <View key={i} style={styles.rowCard} testID={`item-row-${i}`}>
                {r.photo_url
                  ? <Image source={{ uri: r.photo_url }} style={styles.rowThumb} />
                  : null}
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <TextInput
                    testID={`item-name-${i}`}
                    value={r.name}
                    onChangeText={(t) => setFree(i, { name: t })}
                    placeholder="e.g. Amul Butter 500g"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                  />
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={styles.qtyBox}>
                      <TouchableOpacity testID={`qty-dec-${i}`} onPress={() => setFree(i, { qty: Math.max(1, r.qty - 1) })} style={styles.qtyBoxBtn}><Text style={styles.qtyBtnT}>−</Text></TouchableOpacity>
                      <Text style={styles.qtyText}>{r.qty}</Text>
                      <TouchableOpacity testID={`qty-inc-${i}`} onPress={() => setFree(i, { qty: r.qty + 1 })} style={styles.qtyBoxBtn}><Text style={styles.qtyBtnT}>+</Text></TouchableOpacity>
                    </View>
                    <TextInput
                      value={r.note}
                      onChangeText={(t) => setFree(i, { note: t })}
                      placeholder="Note (brand, size...)"
                      placeholderTextColor={colors.textSubtle}
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>
                </View>
                <TouchableOpacity testID={`item-del-${i}`} onPress={() => delFree(i)} style={styles.delBtn} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.aiRow}>
              <VoiceOrderButton onItems={addAiItems} />
              <PhotoListButton onItems={addAiItems} />
            </View>
            <TouchableOpacity testID="add-item-btn" onPress={addFreeRow} style={styles.addRow} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={colors.brand} />
              <Text style={styles.addRowText}>Add {catalog.length ? "custom" : "an"} item</Text>
            </TouchableOpacity>

            <Text style={styles.section}>Payment</Text>
            <View style={{ gap: spacing.sm }}>
              <PayOption id="cod" title="Cash on Pickup" desc="Pay in cash at the shop" active={payment === "cod"} onPress={() => setPayment("cod")} icon="cash-outline" />
              <PayOption id="upi" title="UPI / GPay at Pickup" desc={`Scan ${shop.upi_id || "shop QR"} at counter`} active={payment === "upi"} onPress={() => setPayment("upi")} icon="qr-code-outline" />
              <PayOption id="online" title="Pay Online" desc="Pay via Razorpay (UPI, card, netbanking) after shop confirms" active={payment === "online"} onPress={() => setPayment("online")} icon="card-outline" />
            </View>

            <Text style={styles.section}>Notes for shopkeeper</Text>
            <TextInput
              testID="notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Please pack fresh only"
              placeholderTextColor={colors.textSubtle}
              multiline
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
            />

            {err ? <Text style={styles.err} testID="place-order-error">{err}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barLabel}>{cartCount} item{cartCount === 1 ? "" : "s"}</Text>
            {catalogTotal > 0 ? <Text style={styles.barTotal}>₹{catalogTotal.toFixed(0)}</Text> : <Text style={styles.barHint}>Total set by shop</Text>}
          </View>
          <TouchableOpacity
            testID="place-order-btn"
            onPress={submit}
            disabled={submitting || !shop.is_open || !canSubmit}
            style={[styles.cta, (submitting || !shop.is_open || !canSubmit) && { opacity: 0.5 }]}
            activeOpacity={0.9}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Place Order</Text>}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaChip({ icon, text, color }: any) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ ...font.small, color: colors.textMuted }}>{text}</Text>
    </View>
  );
}

function PayOption({ id, title, desc, active, onPress, icon }: any) {
  return (
    <TouchableOpacity testID={`pay-${id}`} onPress={onPress} activeOpacity={0.85} style={[styles.payCard, active && styles.payCardActive]}>
      <View style={[styles.payIcon, active && { backgroundColor: colors.brand }]}>
        <Ionicons name={icon} size={18} color={active ? "#fff" : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.payTitle}>{title}</Text>
        <Text style={styles.payDesc}>{desc}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: { width: "100%", height: 220, backgroundColor: "#E2E8F0" },
  headBack: { position: "absolute", top: spacing.lg, left: spacing.lg, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: "#FFFFFFEE", alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg, gap: 4 },
  title: { ...font.h1, color: colors.text },
  cat: { ...font.small, color: colors.textMuted },
  addr: { ...font.small, color: colors.textSubtle, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 30, borderWidth: 1, borderColor: colors.border },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.sm, paddingVertical: 7, paddingHorizontal: spacing.md, backgroundColor: "#ECFDF5", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand },
  mapBtnText: { ...font.small, color: colors.brand, fontWeight: "700" },
  mapBtnDist: { ...font.small, color: colors.brandDark },
  closedBanner: { backgroundColor: "#FEF2F2", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: "#FCA5A5" },
  closedText: { color: colors.danger, ...font.small },
  section: { ...font.h3, color: colors.text, marginTop: spacing.xl },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  catHeading: { ...font.caption, color: colors.textSubtle, marginBottom: spacing.sm },
  itemCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemThumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: "#E2E8F0" },
  itemThumbEmpty: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  itemName: { ...font.body, color: colors.text, fontWeight: "700" },
  itemMeta: { ...font.small, color: colors.textSubtle, marginTop: 2 },
  itemPrice: { ...font.body, color: colors.brandDark, fontWeight: "800", marginTop: 4 },
  oosLabel: { ...font.small, color: colors.danger, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: 14, height: 36, borderRadius: radius.pill },
  addBtnText: { color: "#fff", fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 4, height: 36 },
  qtyBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  qtyBtnT: { fontSize: 20, color: "#fff", fontWeight: "800" },
  qtyText: { minWidth: 22, textAlign: "center", ...font.body, color: "#fff", fontWeight: "800" },
  rowCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, alignItems: "flex-start" },
  rowThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: "#E2E8F0", marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, ...font.body, color: colors.text, backgroundColor: colors.card },
  qtyBox: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, backgroundColor: colors.brand, height: 42 },
  qtyBoxBtn: { width: 36, height: 42, alignItems: "center", justifyContent: "center" },
  delBtn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginTop: 6 },
  aiRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed", marginTop: spacing.sm },
  addRowText: { color: colors.brand, fontWeight: "700" },
  payCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  payCardActive: { borderColor: colors.brand, backgroundColor: "#F0FDF4" },
  payIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  payTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  payDesc: { ...font.small, color: colors.textMuted },
  radio: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.brand },
  err: { color: colors.danger, ...font.small, marginTop: spacing.md, textAlign: "center" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: "#FFFFFFEE", borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md },
  barLabel: { ...font.small, color: colors.textMuted },
  barTotal: { ...font.h3, color: colors.text },
  barHint: { ...font.small, color: colors.textSubtle },
  cta: { flex: 1, backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ctaText: { color: "#fff", ...font.h3 },
});
