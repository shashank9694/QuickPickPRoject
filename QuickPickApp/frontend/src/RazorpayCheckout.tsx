import { useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing, radius } from "@/src/theme";

export type RazorpayResult =
  | { success: true; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
  | { success: false; reason: string };

type Props = {
  keyId: string;
  rzpOrderId: string;
  amountPaise: number;
  customerName: string;
  customerPhone: string;
  description: string;
  onResult: (result: RazorpayResult) => void;
  onClose: () => void;
};

function buildCheckoutHtml(p: Omit<Props, "onResult" | "onClose">) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .loader { color: #10b981; font-family: sans-serif; font-size: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="loader">Opening payment…</div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    window.onload = function() {
      var options = {
        key: "${p.keyId}",
        amount: ${p.amountPaise},
        currency: "INR",
        name: "QuickPick",
        description: "${p.description.replace(/"/g, "'")}",
        order_id: "${p.rzpOrderId}",
        prefill: {
          name: "${p.customerName.replace(/"/g, "'")}",
          contact: "${p.customerPhone}"
        },
        theme: { color: "#10b981" },
        handler: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            success: true,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          }));
        },
        modal: {
          ondismiss: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ success: false, reason: "dismissed" }));
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on("payment.failed", function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ success: false, reason: response.error.description || "Payment failed" }));
      });
      rzp.open();
    };
  </script>
</body>
</html>`;
}

export default function RazorpayCheckout(props: Props) {
  const webRef = useRef<WebView>(null);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const result: RazorpayResult = JSON.parse(event.nativeEvent.data);
      props.onResult(result);
    } catch {
      props.onResult({ success: false, reason: "Unknown error" });
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Secure Payment</Text>
        <TouchableOpacity onPress={props.onClose} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <WebView
        ref={webRef}
        source={{ html: buildCheckoutHtml(props) }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.loaderText}>Loading payment gateway…</Text>
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...font.h3, color: colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  webview: { flex: 1 },
  loader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loaderText: { ...font.body, color: colors.textMuted },
});
