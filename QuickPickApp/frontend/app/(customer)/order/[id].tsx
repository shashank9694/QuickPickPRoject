import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { colors, font, spacing, radius, statusColor, statusLabel } from "@/src/theme";
import { api, Order } from "@/src/api";
import { useAuth } from "@/src/auth";
import RazorpayCheckout, { RazorpayResult } from "@/src/RazorpayCheckout";

const STEPS: Array<{ key: Order["status"]; label: string }> = [
  { key: "submitted", label: "Placed" },
  { key: "awaiting_payment", label: "Pay" },
  { key: "packaging", label: "Packing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Done" },
];

const STEP_ORDER: Order["status"][] = ["submitted", "awaiting_payment", "packaging", "ready", "completed"];

type RzpInit = {
  key_id: string;
  rzp_order_id: string;
  amount_paise: number;
  amount_inr: number;
  payment_type: "full" | "cod_advance";
  customer_name: string;
  customer_phone: string;
};

export default function OrderTrack() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [payOk, setPayOk] = useState(false);
  const [rzpData, setRzpData] = useState<RzpInit | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Order>(`/orders/${id}`);
      setOrder(data);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cancel = async () => {
    if (!order) return;
    try {
      await api.patch(`/orders/${order.id}/status`, null, { params: { new_status: "cancelled" } });
      await load();
    } catch {}
  };

  const initiatePayment = async () => {
    if (!order) return;
    setPayMsg(""); setPayBusy(true);
    try {
      const { data } = await api.post<RzpInit>(`/orders/${order.id}/initiate-payment`);
      setRzpData(data);
    } catch (e: any) {
      setPayMsg(e?.response?.data?.detail || "Failed to initiate payment");
      setPayOk(false);
    } finally {
      setPayBusy(false);
    }
  };

  const handleRzpResult = async (result: RazorpayResult) => {
    setRzpData(null);
    if (!order) return;
    if (!result.success) {
      setPayMsg(result.reason === "dismissed" ? "Payment cancelled." : `Payment failed: ${result.reason}`);
      setPayOk(false);
      return;
    }
    setPayBusy(true);
    try {
      await api.post(`/orders/${order.id}/verify-payment`, {
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_signature: result.razorpay_signature,
      });
      await load();
      setPayMsg("Payment successful! Order is now being packed.");
      setPayOk(true);
    } catch (e: any) {
      setPayMsg(e?.response?.data?.detail || "Payment verification failed");
      setPayOk(false);
    } finally {
      setPayBusy(false);
    }
  };

  if (loading || !order) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const stepIdx = STEP_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isTerminal = order.status === "completed" || isCancelled;
  const isAwaiting = order.status === "awaiting_payment";
  const isReady = order.status === "ready";

  const codAdvance = order.cod_advance_amount ?? Math.round(order.total * 0.1);
  const codRemaining = order.total - codAdvance;
  const isCod = order.payment_method === "cod";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Razorpay WebView Modal */}
      {rzpData && (
        <Modal animationType="slide" visible statusBarTranslucent>
          <SafeAreaView style={{ flex: 1 }}>
            <RazorpayCheckout
              keyId={rzpData.key_id}
              rzpOrderId={rzpData.rzp_order_id}
              amountPaise={rzpData.amount_paise}
              customerName={rzpData.customer_name}
              customerPhone={rzpData.customer_phone}
              description={`Order from ${order.shop_name}`}
              onResult={handleRzpResult}
              onClose={() => setRzpData(null)}
            />
          </SafeAreaView>
        </Modal>
      )}

      <View style={styles.header}>
        <TouchableOpacity testID="order-back-btn" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Shop + Status */}
        <View style={styles.card}>
          <Text style={styles.shop}>{order.shop_name}</Text>
          <Text style={styles.addr}>{order.shop_address}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor(order.status) + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor(order.status) }]}>{statusLabel(order.status)}</Text>
          </View>
        </View>

        {/* Progress timeline */}
        {!isCancelled && (
          <View style={styles.timeline}>
            {STEPS.map((s, i) => {
              const done = stepIdx >= i;
              const active = stepIdx === i;
              return (
                <View key={s.key} style={styles.step}>
                  <View style={styles.stepLine}>
                    <View style={[styles.stepDot, done && { backgroundColor: colors.brand, borderColor: colors.brand }, active && styles.stepDotActive]}>
                      {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    {i < STEPS.length - 1 && (
                      <View style={[styles.stepConnector, stepIdx > i && { backgroundColor: colors.brand }]} />
                    )}
                  </View>
                  <Text style={[styles.stepLabel, done && { color: colors.text, fontWeight: "700" }]}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Payment section (awaiting_payment) ── */}
        {isAwaiting && (
          <View style={styles.payCard}>
            <Text style={styles.payTitle}>Payment Required</Text>
            <Text style={styles.payTotal}>₹{order.total.toFixed(0)}</Text>
            <Text style={styles.payHint}>Shopkeeper has reviewed and priced your order.</Text>

            {payMsg ? (
              <Text style={[styles.payMsg, { color: payOk ? colors.brandDark : colors.danger }]}>{payMsg}</Text>
            ) : null}

            {isCod ? (
              <>
                <View style={styles.codBreakdown}>
                  <View style={styles.codRow}>
                    <Text style={styles.codLabel}>Pay online now (10%)</Text>
                    <Text style={styles.codAmount}>₹{codAdvance.toFixed(0)}</Text>
                  </View>
                  <View style={styles.codRow}>
                    <Text style={styles.codLabel}>Pay at pickup</Text>
                    <Text style={styles.codAmount}>₹{codRemaining.toFixed(0)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="pay-cod-advance-btn"
                  style={[styles.payBtn, payBusy && { opacity: 0.7 }]}
                  onPress={initiatePayment}
                  disabled={payBusy}
                  activeOpacity={0.85}
                >
                  {payBusy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="card" size={20} color="#fff" />
                      <Text style={styles.payBtnText}>Pay ₹{codAdvance.toFixed(0)} Advance</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                testID="pay-online-btn"
                style={[styles.payBtn, payBusy && { opacity: 0.7 }]}
                onPress={initiatePayment}
                disabled={payBusy}
                activeOpacity={0.85}
              >
                {payBusy ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="card" size={20} color="#fff" />
                    <Text style={styles.payBtnText}>Pay ₹{order.total.toFixed(0)} Online</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* OTP card (ready for pickup) */}
        {isReady && (
          <View style={styles.otpCard} testID="pickup-otp-card">
            <Text style={styles.otpLabel}>Show at counter</Text>
            <Text style={styles.otpValue}>{order.pickup_otp.match(/.{1,4}/g)?.join(" ")}</Text>
            <View style={styles.qrBox}>
              <QRCode value={`quickpick:${order.id}:${order.pickup_otp}`} size={140} />
            </View>
            <Text style={styles.otpHint}>Shopkeeper will enter this OTP to complete your order.</Text>
            {isCod && order.payment_status === "cod_advance_paid" && (
              <View style={styles.balanceBadge}>
                <Ionicons name="cash" size={16} color="#92400E" />
                <Text style={styles.balanceText}>Pay ₹{codRemaining.toFixed(0)} cash at pickup</Text>
              </View>
            )}
          </View>
        )}

        {/* Completed */}
        {order.status === "completed" && (
          <View style={styles.completedCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.brand} />
            <Text style={styles.completedTitle}>Order Complete!</Text>
            <Text style={styles.completedSub}>Enjoy your order from {order.shop_name}.</Text>
          </View>
        )}

        {/* Items */}
        <Text style={styles.section}>Items ({order.items.length})</Text>
        <View style={styles.card}>
          {order.items.map((it, i) => (
            <View key={i} style={[styles.itemRow, i < order.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Ionicons
                name={it.out_of_stock ? "close-circle" : "checkmark-circle"}
                size={20}
                color={it.out_of_stock ? colors.danger : colors.brand}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, it.out_of_stock && { textDecorationLine: "line-through", color: colors.textSubtle }]}>
                  {it.qty}× {it.name}
                </Text>
                {it.note ? <Text style={styles.itemNote}>{it.note}</Text> : null}
              </View>
              {it.price != null && !it.out_of_stock && (
                <Text style={styles.itemPrice}>₹{it.price}</Text>
              )}
              {it.out_of_stock && (
                <Text style={styles.oosBadge}>Unavailable</Text>
              )}
            </View>
          ))}
        </View>

        {/* Payment summary */}
        <Text style={styles.section}>Payment</Text>
        <View style={styles.card}>
          <Row label="Method" value={isCod ? "Cash on Pickup (COD)" : "Online"} />
          <Row label="Total" value={order.total > 0 ? `₹${order.total.toFixed(0)}` : "Awaiting shopkeeper"} bold />
          {isCod && order.cod_advance_amount != null && (
            <>
              <Row label="Advance Paid" value={`₹${order.cod_advance_amount.toFixed(0)}`} />
              <Row label="Balance at Pickup" value={`₹${(order.total - order.cod_advance_amount).toFixed(0)}`} />
            </>
          )}
          <Row label="Payment Status" value={order.payment_status.replace(/_/g, " ").toUpperCase()} />
        </View>

        {/* Cancel */}
        {!isTerminal && (
          <TouchableOpacity testID="cancel-order-btn" onPress={cancel} style={styles.cancelBtn} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel order</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.pRow}>
      <Text style={{ ...font.small, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...font.body, color: colors.text, fontWeight: bold ? "800" : "500" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, backgroundColor: colors.bg },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  headerTitle: { ...font.h3, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  shop: { ...font.h2, color: colors.text },
  addr: { ...font.small, color: colors.textMuted, marginTop: 2 },
  statusPill: { alignSelf: "flex-start", marginTop: spacing.md, paddingHorizontal: 12, height: 26, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  timeline: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, flexDirection: "row", justifyContent: "space-between" },
  step: { alignItems: "center", flex: 1 },
  stepLine: { alignItems: "center", flexDirection: "row", width: "100%", justifyContent: "center" },
  stepDot: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", zIndex: 1 },
  stepDotActive: { borderColor: colors.brand, borderWidth: 2 },
  stepConnector: { position: "absolute", left: "60%", right: "-40%", height: 2, top: 11, backgroundColor: colors.border },
  stepLabel: { ...font.small, color: colors.textSubtle, marginTop: spacing.xs, textAlign: "center", fontSize: 10 },
  payCard: { backgroundColor: "#F5F3FF", borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: "#DDD6FE", marginBottom: spacing.md, gap: spacing.sm },
  payTitle: { ...font.h3, color: colors.awaiting_payment },
  payTotal: { fontSize: 36, fontWeight: "800", color: colors.text },
  payHint: { ...font.small, color: colors.textMuted },
  payMsg: { ...font.small, fontWeight: "700" },
  payBtn: { backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  payBtnText: { color: "#fff", ...font.h3 },
  codBreakdown: { backgroundColor: "#fff", borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: "#DDD6FE" },
  codRow: { flexDirection: "row", justifyContent: "space-between" },
  codLabel: { ...font.small, color: colors.textMuted },
  codAmount: { ...font.small, color: colors.text, fontWeight: "700" },
  otpCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 2, borderColor: colors.brand, alignItems: "center", marginBottom: spacing.md, gap: spacing.md },
  otpLabel: { ...font.caption, color: colors.brandDark },
  otpValue: { fontSize: 36, letterSpacing: 8, fontWeight: "800", color: colors.text },
  qrBox: { padding: spacing.md, backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  otpHint: { ...font.small, color: colors.textMuted, textAlign: "center" },
  balanceBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFFBEB", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#FDE68A" },
  balanceText: { ...font.small, color: "#92400E", fontWeight: "700" },
  completedCard: { backgroundColor: "#ECFDF5", borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: spacing.md },
  completedTitle: { ...font.h2, color: colors.brandDark },
  completedSub: { ...font.body, color: colors.textMuted },
  section: { ...font.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  itemName: { ...font.body, color: colors.text },
  itemNote: { ...font.small, color: colors.textMuted },
  itemPrice: { ...font.body, color: colors.brandDark, fontWeight: "700" },
  oosBadge: { fontSize: 10, fontWeight: "800", color: colors.danger, backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  pRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  cancelBtn: { alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.pill, borderWidth: 1, borderColor: "#FCA5A5", marginTop: spacing.md },
  cancelText: { color: colors.danger, fontWeight: "700" },
});
