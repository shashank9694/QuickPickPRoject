import React, { useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
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
  const mapRef = useRef<MapView>(null);

  const initialRegion: Region = {
    latitude: pin.lat,
    longitude: pin.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ lat: latitude, lng: longitude });
  };

  const onDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ lat: latitude, lng: longitude });
  };

  const useMyLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPin(next);
      mapRef.current?.animateToRegion({ latitude: next.lat, longitude: next.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pin.lat, longitude: pin.lng });
      const address = [geo?.street, geo?.district, geo?.city, geo?.region].filter(Boolean).join(", ") || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
      onConfirm(pin, address);
    } catch {
      onConfirm(pin, `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onPress={onMapPress}
        >
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            draggable
            onDragEnd={onDragEnd}
            pinColor={colors.brand}
          />
        </MapView>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Pick location</Text>
          <TouchableOpacity onPress={useMyLocation} disabled={busy} style={styles.iconBtn}>
            <Ionicons name="locate" size={22} color={colors.brand} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.coordText}>{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</Text>
          <Text style={styles.hint}>Tap the map or drag the pin to set location</Text>
          <TouchableOpacity onPress={confirm} disabled={busy} style={[styles.confirmBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Use this location</Text>}
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
  topTitle: { ...font.h3, color: colors.text },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  bottom: {
    backgroundColor: "#FFFFFFEE",
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  coordText: { ...font.small, color: colors.textMuted, fontFamily: "monospace" },
  hint: { ...font.small, color: colors.textSubtle },
  confirmBtn: { backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  confirmText: { color: "#fff", ...font.h3 },
});
