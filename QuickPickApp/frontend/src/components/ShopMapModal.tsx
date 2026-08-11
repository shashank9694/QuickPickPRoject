import React from "react";
import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "@/src/theme";
import { Shop } from "@/src/api";

type Props = {
  visible: boolean;
  shop: Shop;
  onClose: () => void;
};

export function ShopMapModal({ visible, shop, onClose }: Props) {
  const distLabel = shop.distance_km != null
    ? (shop.distance_km < 1
      ? `${(shop.distance_km * 1000).toFixed(0)} m away`
      : `${shop.distance_km.toFixed(2)} km away`)
    : null;

  const openDirections = () => {
    const androidUrl = `google.navigation:q=${shop.lat},${shop.lng}`;
    const iosUrl = `maps:0,0?q=${encodeURIComponent(shop.name)}@${shop.lat},${shop.lng}`;
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
    const target = Platform.OS === "ios" ? iosUrl : androidUrl;
    Linking.openURL(target).catch(() => Linking.openURL(fallback));
  };

  const openGoogleMaps = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{shop.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Map placeholder */}
          <TouchableOpacity style={styles.mapPlaceholder} activeOpacity={0.8} onPress={openGoogleMaps}>
            <Ionicons name="map" size={48} color={colors.brand} />
            <Text style={styles.mapHint}>Tap to open in Google Maps</Text>
            <Text style={styles.coordText}>{shop.lat.toFixed(5)}, {shop.lng.toFixed(5)}</Text>
          </TouchableOpacity>

          {/* Shop info */}
          <View style={styles.infoRow}>
            <View style={styles.shopIcon}>
              <Ionicons name="storefront" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopAddr}>{shop.address}</Text>
              {distLabel && (
                <View style={styles.distRow}>
                  <Ionicons name="navigate" size={13} color={colors.brandDark} />
                  <Text style={styles.distText}>{distLabel}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.mapsBtn} onPress={openGoogleMaps} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={18} color={colors.brand} />
              <Text style={styles.mapsBtnText}>View Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirBtn} onPress={openDirections} activeOpacity={0.85}>
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.dirBtnText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 36,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...font.h2, color: colors.text, flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapPlaceholder: {
    height: 160,
    backgroundColor: "#ECFDF5",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mapHint: { ...font.body, color: colors.brand, fontWeight: "700" },
  coordText: { ...font.small, color: colors.textMuted },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopName: { ...font.h3, color: colors.text },
  shopAddr: { ...font.small, color: colors.textMuted, marginTop: 2 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  distText: { ...font.small, color: colors.brandDark, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: spacing.md },
  mapsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  mapsBtnText: { color: colors.brand, ...font.h3 },
  dirBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    height: 50,
    borderRadius: radius.pill,
  },
  dirBtnText: { color: "#fff", ...font.h3 },
});
