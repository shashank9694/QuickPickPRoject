import React, { useEffect, useRef, useState } from "react";
import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "@/src/theme";
import { Shop } from "@/src/api";

type Props = {
  visible: boolean;
  shop: Shop;
  onClose: () => void;
};

export function ShopMapModal({ visible, shop, onClose }: Props) {
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setMyLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {}
    })();
  }, [visible]);

  // Fit map to show both shop and customer once myLoc is known
  useEffect(() => {
    if (!visible) return;
    const coords: { latitude: number; longitude: number }[] = [
      { latitude: shop.lat, longitude: shop.lng },
    ];
    if (myLoc) coords.push({ latitude: myLoc.lat, longitude: myLoc.lng });

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [visible, myLoc, shop.lat, shop.lng]);

  const openDirections = () => {
    const iosUrl = `maps:0,0?q=${encodeURIComponent(shop.name)}@${shop.lat},${shop.lng}`;
    const androidUrl = `google.navigation:q=${shop.lat},${shop.lng}`;
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}&destination_place_id=${encodeURIComponent(shop.name)}`;

    const target = Platform.OS === "ios" ? iosUrl : androidUrl;
    Linking.openURL(target).catch(() => Linking.openURL(fallback));
  };

  const openGoogleMaps = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`);
  };

  const distLabel = shop.distance_km != null
    ? (shop.distance_km < 1
      ? `${(shop.distance_km * 1000).toFixed(0)} m away`
      : `${shop.distance_km.toFixed(2)} km away`)
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: shop.lat,
            longitude: shop.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Shop pin */}
          <Marker
            coordinate={{ latitude: shop.lat, longitude: shop.lng }}
            pinColor={colors.brand}
          >
            <Callout>
              <View style={{ padding: 6, maxWidth: 180 }}>
                <Text style={{ fontWeight: "700", fontSize: 13 }}>{shop.name}</Text>
                <Text style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{shop.address}</Text>
              </View>
            </Callout>
          </Marker>

          {/* Customer pin (explicit, in case showsUserLocation is subtle) */}
          {myLoc && (
            <Marker
              coordinate={{ latitude: myLoc.lat, longitude: myLoc.lng }}
              pinColor="#3B82F6"
              title="You are here"
            />
          )}
        </MapView>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{shop.name}</Text>
          <TouchableOpacity onPress={openGoogleMaps} style={styles.iconBtn}>
            <Ionicons name="open-outline" size={20} color={colors.brand} />
          </TouchableOpacity>
        </View>

        {/* Bottom info panel */}
        <View style={styles.bottom}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={styles.shopIconWrap}>
              <Ionicons name="storefront" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopAddr}>{shop.address}</Text>
              {distLabel ? (
                <View style={styles.distRow}>
                  <Ionicons name="navigate" size={13} color={colors.brandDark} />
                  <Text style={styles.distText}>{distLabel}</Text>
                  {myLoc ? <Text style={styles.liveLabel}>LIVE</Text> : null}
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity onPress={openDirections} style={styles.dirBtn} activeOpacity={0.85}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.dirBtnText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: "#FFFFFFEE",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { ...font.h3, color: colors.text, flex: 1, textAlign: "center", marginHorizontal: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  bottom: {
    backgroundColor: "#FFFFFFEE",
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  shopIconWrap: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  shopName: { ...font.h3, color: colors.text },
  shopAddr: { ...font.small, color: colors.textMuted, marginTop: 2 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  distText: { ...font.small, color: colors.brandDark, fontWeight: "700" },
  liveLabel: { fontSize: 9, fontWeight: "800", color: "#10B981", backgroundColor: "#ECFDF5", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, letterSpacing: 0.5 },
  dirBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, height: 52, borderRadius: radius.pill },
  dirBtnText: { color: "#fff", ...font.h3 },
});
