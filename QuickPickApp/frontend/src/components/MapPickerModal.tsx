import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "@/src/theme";

type LatLng = { lat: number; lng: number };

type Props = {
  visible: boolean;
  initial?: LatLng;
  onConfirm: (loc: LatLng, address: string) => void;
  onClose: () => void;
};

const DEFAULT: LatLng = { lat: 20.5937, lng: 78.9629 }; // India center

export function MapPickerModal({ visible, initial, onConfirm, onClose }: Props) {
  const [pin, setPin] = useState<LatLng>(initial ?? DEFAULT);
  const [busy, setBusy] = useState(false);
  const [gotLocation, setGotLocation] = useState(!!initial);

  const useMyLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setGotLocation(true);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pin.lat, longitude: pin.lng });
      const address = [geo?.street, geo?.district, geo?.city, geo?.region].filter(Boolean).join(", ")
        || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
      onConfirm(pin, address);
    } catch {
      onConfirm(pin, `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`);
    } finally {
      setBusy(false);
    }
  };

  const previewInMaps = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Set Shop Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Location display */}
          <View style={styles.locationCard}>
            <Ionicons name="location" size={40} color={gotLocation ? colors.brand : colors.textMuted} />
            {gotLocation ? (
              <>
                <Text style={styles.coordText}>{pin.lat.toFixed(6)}</Text>
                <Text style={styles.coordText}>{pin.lng.toFixed(6)}</Text>
                <TouchableOpacity onPress={previewInMaps} style={styles.previewLink}>
                  <Ionicons name="open-outline" size={14} color={colors.brand} />
                  <Text style={styles.previewLinkText}>Preview in Google Maps</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noLocText}>No location set yet.{"\n"}Use the button below to get your current location.</Text>
            )}
          </View>

          {/* Use my location button */}
          <TouchableOpacity
            style={[styles.locBtn, busy && { opacity: 0.6 }]}
            onPress={useMyLocation}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={colors.brand} />
              : <Ionicons name="locate" size={20} color={colors.brand} />
            }
            <Text style={styles.locBtnText}>Use My Current Location</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>This will use your GPS location as the shop address.</Text>

          {/* Confirm */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!gotLocation || busy) && { opacity: 0.5 }]}
            onPress={confirm}
            disabled={!gotLocation || busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmText}>Use this location</Text>
            }
          </TouchableOpacity>
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
  title: { ...font.h2, color: colors.text },
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
  locationCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: 6,
    minHeight: 140,
    justifyContent: "center",
  },
  coordText: { ...font.body, color: colors.text, fontWeight: "700", fontFamily: "monospace" },
  noLocText: { ...font.small, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  previewLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  previewLinkText: { ...font.small, color: colors.brand, fontWeight: "600" },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  locBtnText: { color: colors.brand, ...font.h3 },
  hint: { ...font.small, color: colors.textMuted, textAlign: "center" },
  confirmBtn: {
    backgroundColor: colors.brand,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: "#fff", ...font.h3 },
});
