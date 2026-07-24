import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius, statusColor, statusLabel } from "@/src/theme";
import { api, Order } from "@/src/api";

export default function ManageOrder() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemPrices, setItemPrices] = useState<Record<number, string>>({});
  const [otpInput, setOtpInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Order>(`/orders/${id}`);
      setOrder(data);
      // Pre-fill price inputs from existing item prices
      const prices: Record<number, string> = {};
      data.items.forEach((it, i) => { if (it.price != null) prices[i] = String(it.price); });
      setItemPrices(prices);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const showMsg = (text: string, ok = false) => { setMsg(text); setMsgOk(ok); };

  const toggleOOS = async (index: number, val: boolean) => {
    if (!order) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${id}/items`, { index, out_of_stock: val });
      setOrder((o) => o ? { ...o, items: data.items, total: data.total } : o);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const saveItemPrice = async (index: number) => {
    const raw = itemPrices[index];
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) { showMsg("Enter a valid price"); return; }
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${id}/items`, { index, price });
      setOrder((o) => o ? { ...o, items: data.items, total: data.total } : o);
      showMsg("Price saved", true);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const sendToPayment = async () => {
    setMsg(""); setBusy(true);
    try {
      await api.post(`/orders/${id}/send-to-payment`);
      await load();
      showMsg("Order sent to customer for payment", true);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const markReady = async () => {
    setMsg(""); setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, null, { params: { new_status: "ready" } });
      await load();
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const verifyPickup = async () => {
    setMsg(""); setBusy(true);
    try {
      await api.post(`/orders/${id}/verify-pickup`, { otp: otpInput });
      await load();
      showMsg("Order completed!", true);
      setOtpInput("");
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const cancelOrder = async () => {
    setMsg(""); setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, null, { params: { new_status: "cancelled" } });
      await load();
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  if (loading || !order) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const isSubmitted = order.status === "submitted";
  const isAwaiting = order.status === "awaiting_payment";
  const isPackaging = order.status === "packaging";
  const isReady = order.status === "ready";
  const isTerminal = order.status === "completed" || order.status === "cancelled";

  const availableItems = order.items.filter((it) => !it.out_of_stock);
  const allPriced = availableItems.length > 0 && availableItems.every((it) => it.price != null && it.price > 0);

  // Live total recalculated from typed price inputs so shopkeeper sees subtotal update as they type
  const liveTotal = order.items.reduce((sum, it, i) => {
    if (it.out_of_stock) return sum;
    const typed = itemPrices[i];
    const price = typed !== undefined ? parseFloat(typed) : (it.price ?? 0);
    return sum + (isNaN(price) ? 0 : price) * Math.max(1, it.qty);
  }, 0);

  const paymentLabel = order.payment_method === "cod"
    ? `COD — Customer pays ₹${order.cod_advance_amount?.toFixed(0) ?? Math.round(order.total * 0.1)} online + ₹${Math.round(order.total - (order.cod_advance_amount ?? order.total * 0.1))} at pickup`
    : `Online — Customer pays ₹${order.total.toFixed(0)} in full`;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="sk-order-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Order</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {/* Order summary card */}
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{order.customer_name}</Text>
                <Text style={styles.sub}>{order.customer_phone}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusColor(order.status) + "22" }]}>
                <Text style={[styles.statusText, { color: statusColor(order.status) }]}>{statusLabel(order.status)}</Text>
              </View>
            </View>
            <Text style={styles.sub}>Placed: {new Date(order.created_at).toLocaleString()}</Text>
            {order.notes ? <Text style={styles.note}>"{order.notes}"</Text> : null}
          </View>

          {/* ── STEP 1: Review items + set prices ── */}
          {isSubmitted && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Review Items</Text>
                <Text style={styles.sectionHint}>Mark unavailable items as OOS, then set prices</Text>
              </View>
              <View style={styles.card}>
                {order.items.map((it, i) => (
                  <View key={i} style={[styles.itemRow, i < order.items.length - 1 && styles.itemBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, it.out_of_stock && styles.strikethrough]}>
                        {it.qty}× {it.name}
                      </Text>
                      {it.note ? <Text style={styles.itemNote}>{it.note}</Text> : null}
                    </View>

                    {!it.out_of_stock && (
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <View style={styles.priceRow}>
                          <Text style={styles.rupee}>₹</Text>
                          <TextInput
                            value={itemPrices[i] ?? ""}
                            onChangeText={(v) => setItemPrices((p) => ({ ...p, [i]: v }))}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textSubtle}
                            style={styles.priceInput}
                            onEndEditing={() => saveItemPrice(i)}
                            returnKeyType="done"
                          />
                        </View>
                        {it.qty > 1 && (() => {
                          const p = parseFloat(itemPrices[i] ?? "");
                          return !isNaN(p) && p > 0
                            ? <Text style={styles.lineTotal}>= ₹{(p * it.qty).toFixed(0)}</Text>
                            : null;
                        })()}
                      </View>
                    )}

                    <TouchableOpacity
                      testID={`sk-oos-${i}`}
                      onPress={() => toggleOOS(i, !it.out_of_stock)}
                      style={[styles.oosBtn, it.out_of_stock && styles.oosBtnOn]}
                      disabled={busy}
                    >
                      <Text style={[styles.oosBtnText, it.out_of_stock && { color: "#fff" }]}>
                        {it.out_of_stock ? "Unavail." : "OOS"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>₹{liveTotal.toFixed(0)}</Text>
                {liveTotal !== order.total && order.total > 0 && (
                  <Text style={styles.totalSub}>Saved: ₹{order.total.toFixed(0)}</Text>
                )}
              </View>

              {!allPriced && availableItems.length > 0 && (
                <View style={styles.warnBox}>
                  <Ionicons name="information-circle" size={16} color="#B45309" />
                  <Text style={styles.warnText}>Set prices for all available items before sending</Text>
                </View>
              )}
            </>
          )}

          {/* ── STEP 2: Awaiting payment ── */}
          {isAwaiting && (
            <View style={styles.awaitCard}>
              <Ionicons name="time" size={32} color={colors.awaiting_payment} />
              <Text style={styles.awaitTitle}>Waiting for Payment</Text>
              <Text style={styles.awaitSub}>{paymentLabel}</Text>
              <Text style={styles.awaitHint}>Customer will be notified. The order moves to packaging automatically once payment is received.</Text>
            </View>
          )}

          {/* Items summary (non-submitted states) */}
          {!isSubmitted && (
            <>
              <Text style={styles.section}>Items</Text>
              <View style={styles.card}>
                {order.items.map((it, i) => (
                  <View key={i} style={[styles.itemRow, i < order.items.length - 1 && styles.itemBorder]}>
                    <Ionicons
                      name={it.out_of_stock ? "close-circle" : "checkmark-circle"}
                      size={20}
                      color={it.out_of_stock ? colors.danger : colors.brand}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, it.out_of_stock && styles.strikethrough]}>
                        {it.qty}× {it.name}
                      </Text>
                    </View>
                    {it.price != null && !it.out_of_stock && (
                      <Text style={styles.itemPrice}>₹{it.price}</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Total */}
          {!isSubmitted && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{order.total.toFixed(0)}</Text>
              {order.payment_method === "cod" && order.cod_advance_amount != null && (
                <Text style={styles.totalSub}>
                  Advance paid: ₹{order.cod_advance_amount?.toFixed(0)} · Balance at pickup: ₹{(order.total - order.cod_advance_amount).toFixed(0)}
                </Text>
              )}
            </View>
          )}

          {/* ── STEP 3: OTP verify (ready state) ── */}
          {isReady && (
            <>
              <Text style={styles.section}>Verify Customer OTP</Text>
              <View style={styles.card}>
                <Text style={styles.otpHint}>Ask the customer for their 8-digit pickup OTP</Text>
                <TextInput
                  testID="verify-otp-input"
                  value={otpInput}
                  onChangeText={setOtpInput}
                  keyboardType="numeric"
                  maxLength={8}
                  placeholder="Enter 8-digit OTP"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.otpInput}
                />
                <TouchableOpacity
                  testID="verify-pickup-btn"
                  onPress={verifyPickup}
                  disabled={busy || otpInput.length < 8}
                  style={[styles.verifyBtn, (busy || otpInput.length < 8) && { opacity: 0.5 }]}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.verifyText}>Verify & Complete Order</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {msg ? (
            <Text style={[styles.msg, { color: msgOk ? colors.brandDark : colors.danger }]}>{msg}</Text>
          ) : null}
        </ScrollView>

        {/* Bottom action bar */}
        {!isTerminal && (
          <View style={styles.bottomBar}>
            {isSubmitted && (
              <TouchableOpacity
                testID="send-payment-btn"
                disabled={busy || !allPriced}
                onPress={sendToPayment}
                style={[styles.primaryBtn, (!allPriced) && { opacity: 0.5 }]}
              >
                <Text style={styles.primaryBtnText}>Send for Payment</Text>
              </TouchableOpacity>
            )}
            {isPackaging && (
              <TouchableOpacity testID="mark-ready-btn" disabled={busy} onPress={markReady} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Mark as Ready for Pickup</Text>
              </TouchableOpacity>
            )}
            {(isSubmitted || isAwaiting) && (
              <TouchableOpacity testID="cancel-order-btn" disabled={busy} onPress={cancelOrder} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  headerTitle: { ...font.h3, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  name: { ...font.h3, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "800" },
  note: { marginTop: spacing.sm, ...font.small, color: colors.textMuted, fontStyle: "italic" },
  sectionRow: { marginBottom: spacing.sm },
  section: { ...font.h3, color: colors.text, marginTop: spacing.md, marginBottom: 2 },
  sectionHint: { ...font.small, color: colors.textSubtle },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { ...font.body, color: colors.text, fontWeight: "600" },
  itemNote: { ...font.small, color: colors.textMuted },
  itemPrice: { ...font.body, color: colors.brandDark, fontWeight: "700" },
  strikethrough: { textDecorationLine: "line-through", color: colors.textSubtle },
  priceRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: "hidden", height: 38 },
  rupee: { paddingHorizontal: spacing.sm, ...font.body, color: colors.text, fontWeight: "700" },
  priceInput: { width: 64, height: 38, ...font.body, color: colors.text, paddingHorizontal: spacing.sm },
  lineTotal: { ...font.small, color: colors.brandDark, fontWeight: "700" },
  oosBtn: { paddingHorizontal: 10, height: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  oosBtnOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  oosBtnText: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  totalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, flexDirection: "column", gap: 2 },
  totalLabel: { ...font.small, color: colors.textMuted },
  totalValue: { fontSize: 28, fontWeight: "800", color: colors.text },
  totalSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  warnBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFFBEB", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: "#FDE68A" },
  warnText: { ...font.small, color: "#92400E", flex: 1 },
  awaitCard: { backgroundColor: "#F5F3FF", borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: "#DDD6FE", marginBottom: spacing.md },
  awaitTitle: { ...font.h2, color: colors.awaiting_payment },
  awaitSub: { ...font.body, color: "#5B21B6", textAlign: "center" },
  awaitHint: { ...font.small, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  otpHint: { ...font.small, color: colors.textMuted, marginBottom: spacing.sm },
  otpInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 28, letterSpacing: 6, textAlign: "center", color: colors.text, fontWeight: "800" },
  verifyBtn: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  verifyText: { color: "#fff", ...font.h3 },
  msg: { textAlign: "center", marginTop: spacing.md, ...font.body, fontWeight: "700" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: spacing.sm, backgroundColor: "#FFFFFFEE", borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row" },
  primaryBtn: { flex: 1, backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", ...font.h3 },
  cancelBtn: { paddingHorizontal: spacing.lg, height: 52, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: "#FCA5A5", alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.danger, fontWeight: "700" },
  awaiting_payment: "#8B5CF6",
});
