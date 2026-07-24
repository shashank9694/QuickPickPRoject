import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, font, radius, spacing } from "@/src/theme";
import { ParsedItem } from "./VoiceOrderButton";

type Props = { onItems: (items: ParsedItem[]) => void };

export function PhotoListButton({ onItems }: Props) {
  const [processing, setProcessing] = useState(false);

  const pick = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Camera access needed"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      }
      if (result.canceled || !result.assets[0]) return;

      setProcessing(true);
      const uri = result.assets[0].uri;
      const form = new FormData();
      form.append("file", { uri, name: "list.jpg", type: "image/jpeg" } as any);
      const { data } = await api.post<{ items: ParsedItem[] }>(
        "/ai/image-to-items",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (!data.items.length) { Alert.alert("No items found", "Make sure the list is clearly visible in the photo."); return; }
      onItems(data.items);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Could not read the photo. Please try again.";
      Alert.alert("Photo error", msg);
    } finally {
      setProcessing(false);
    }
  };

  const onPress = () => {
    Alert.alert("Add from photo", "Choose source", [
      { text: "Camera", onPress: () => pick(true) },
      { text: "Gallery", onPress: () => pick(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <TouchableOpacity style={[styles.btn, processing && { opacity: 0.6 }]} onPress={onPress} disabled={processing} activeOpacity={0.8}>
      {processing ? <ActivityIndicator color={colors.brand} size="small" /> : <Ionicons name="camera" size={20} color={colors.brand} />}
      <Text style={styles.text}>{processing ? "Reading..." : "Photo list"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.card },
  text: { ...font.small, color: colors.brand, fontWeight: "700" },
});
