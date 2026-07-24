import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, font, radius, spacing } from "@/src/theme";

export type ParsedItem = { name: string; qty: number; unit?: string; photo_url?: string };

type Props = { onItems: (items: ParsedItem[]) => void };

export function VoiceOrderButton({ onItems }: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);

  const start = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Microphone access needed", "Allow microphone to use voice ordering.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recRef.current = recording;
      setRecording(true);
    } catch {
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stop = async () => {
    if (!recRef.current) return;
    setRecording(false);
    setProcessing(true);
    try {
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      if (!uri) return;

      const form = new FormData();
      form.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as any);
      const { data } = await api.post<{ items: ParsedItem[]; transcript: string }>(
        "/ai/voice-to-items",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (!data.items.length) {
        Alert.alert("Nothing heard", `Heard: "${data.transcript}"\n\nTry saying items clearly, e.g. "2 kg atta, 1 litre milk".`);
        return;
      }
      onItems(data.items);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Could not process voice. Please try again.";
      Alert.alert("Voice error", msg);
    } finally {
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <TouchableOpacity style={[styles.btn, styles.processing]} disabled>
        <ActivityIndicator color={colors.brand} size="small" />
        <Text style={styles.processingText}>Processing...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.btn, recording && styles.btnActive]}
      onPress={recording ? stop : start}
      activeOpacity={0.8}
    >
      <Ionicons name={recording ? "stop-circle" : "mic"} size={20} color={recording ? "#fff" : colors.brand} />
      <Text style={[styles.text, recording && styles.textActive]}>
        {recording ? "Stop" : "Voice order"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.card },
  btnActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  processing: { borderColor: colors.border, backgroundColor: colors.card },
  text: { ...font.small, color: colors.brand, fontWeight: "700" },
  textActive: { color: "#fff" },
  processingText: { ...font.small, color: colors.textMuted },
});
