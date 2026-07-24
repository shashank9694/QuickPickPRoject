import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, Modal, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, CatalogItem, Shop } from "@/src/api";

export default function CatalogEditor() {
  const router = useRouter();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", unit: "", category: "", photo_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", unit: "", category: "", photo_url: "" });
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<{ name: string; price: number; unit: string; category: string; selected: boolean; photo_url?: string }[]>([]);
  const [previewPrices, setPreviewPrices] = useState<Record<number, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [voiceRec, setVoiceRec] = useState(false);
  const [voiceProc, setVoiceProc] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        api.get<Shop>(`/shops/${shopId}`),
        api.get<{ items: CatalogItem[] }>(`/shops/${shopId}/catalog`),
      ]);
      setShop(s.data); setItems(c.data.items);
    } catch {}
  }, [shopId]);

  useFocusEffect(useCallback(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const pickItemPhoto = async (onDone: (url: string) => void) => {
    Alert.alert("Item photo", "Choose source", [
      {
        text: "Camera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Camera access needed"); return; }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
          if (!r.canceled && r.assets[0].base64) onDone(`data:image/jpeg;base64,${r.assets[0].base64}`);
        }
      },
      {
        text: "Gallery", onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
          if (!r.canceled && r.assets[0].base64) onDone(`data:image/jpeg;base64,${r.assets[0].base64}`);
        }
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const addItem = async () => {
    setErr("");
    if (!form.name.trim() || !form.price.trim()) { setErr("Name and price are required"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setErr("Enter a valid price"); return; }
    setSaving(true);
    try {
      await api.post(`/shops/${shopId}/catalog`, { name: form.name.trim(), price, unit: form.unit, category: form.category || "Other", photo_url: form.photo_url });
      setForm({ name: "", price: "", unit: "", category: "", photo_url: "" });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to add item");
    } finally { setSaving(false); }
  };

  const toggleStock = async (it: CatalogItem) => {
    try { await api.patch(`/catalog/${it.id}`, { in_stock: !it.in_stock }); await load(); } catch {}
  };
  const deleteItem = async (id: string) => {
    try { await api.delete(`/catalog/${id}`); await load(); } catch {}
  };
  const startEdit = (it: CatalogItem) => {
    setEditing(it.id);
    setEditForm({ name: it.name, price: String(it.price), unit: it.unit, category: it.category, photo_url: it.photo_url || "" });
  };
  const saveEdit = async () => {
    if (!editing) return;
    const price = parseFloat(editForm.price);
    if (isNaN(price) || price < 0) return;
    try {
      await api.patch(`/catalog/${editing}`, { name: editForm.name, price, unit: editForm.unit, category: editForm.category, photo_url: editForm.photo_url });
      setEditing(null); await load();
    } catch {}
  };

  const startVoice = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Microphone access needed"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recRef.current = recording;
      setVoiceRec(true);
    } catch { Alert.alert("Error", "Could not start recording."); }
  };

  const stopVoice = async () => {
    if (!recRef.current) return;
    setVoiceRec(false);
    setVoiceProc(true);
    try {
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      if (!uri) return;
      const form = new FormData();
      form.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as any);
      const { data } = await api.post<{ items: { name: string; price: number; unit: string; category: string }[]; transcript: string }>(
        "/ai/voice-to-catalog-items", form, { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (!data.items.length) {
        Alert.alert("Nothing heard", `Heard: "${data.transcript}"\n\nTry saying e.g. "Atta 40 rupees, Milk 60 rupees per litre".`);
        return;
      }
      setPreview(data.items.map((it) => ({ ...it, selected: true })));
      setPreviewPrices({});
      setPreviewOpen(true);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not process voice. Try again.");
    } finally { setVoiceProc(false); }
  };

  const bulkFromPhoto = async () => {
    Alert.alert("Import from photo", "Photograph your price list or hand-written menu", [
      { text: "Camera", onPress: () => pickAndScan(true) },
      { text: "Gallery", onPress: () => pickAndScan(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickAndScan = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Camera access needed"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      }
      if (result.canceled || !result.assets[0]) return;

      setScanning(true);
      const uri = result.assets[0].uri;

      const formData = new FormData();
      formData.append("file", { uri, name: "pricelist.jpg", type: "image/jpeg" } as any);
      const { data } = await api.post<{
        items: { name: string; price: number; unit: string; category: string; photo_url?: string }[];
      }>(
        `/shops/${shopId}/catalog/bulk-from-image`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 },
      );
      if (!data.items.length) { Alert.alert("No items found", "Make sure prices and item names are clearly visible."); return; }

      setPreview(data.items.map((it) => ({ ...it, selected: true, photo_url: it.photo_url || "" })));
      setPreviewPrices({});
      setPreviewOpen(true);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not scan price list. Try a clearer photo.");
    } finally {
      setScanning(false);
    }
  };

  const confirmBulk = async () => {
    const resolved = preview.map((it, idx) => {
      const typed = previewPrices[idx];
      const price = typed !== undefined ? parseFloat(typed) : it.price;
      return { ...it, price: isNaN(price) ? 0 : price };
    });
    const selectedItems = resolved.filter((it) => it.selected);
    if (!selectedItems.length) { Alert.alert("Select at least one item"); return; }
    const missingPrice = selectedItems.find((it) => it.price <= 0);
    if (missingPrice) { Alert.alert("Missing price", `Enter a price for "${missingPrice.name}" before adding.`); return; }
    setBulkSaving(true);
    try {
      const { data } = await api.post(`/shops/${shopId}/catalog/bulk`, {
        items: selectedItems.map(({ selected: _, ...it }) => it),
      }, { timeout: 30000 });
      setPreviewOpen(false);
      setPreview([]);
      await load();
      const skipMsg = data.skipped > 0 ? ` (${data.skipped} already existed, skipped)` : "";
      Alert.alert("Done!", `Added ${data.added} item${data.added === 1 ? "" : "s"} to catalog${skipMsg}.`);
    } catch {
      Alert.alert("Error", "Failed to save items.");
    } finally {
      setBulkSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="catalog-back-btn" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{shop?.name}</Text>
            <Text style={styles.sub}>Catalog · {items.length} item{items.length === 1 ? "" : "s"}</Text>
          </View>
          <TouchableOpacity onPress={voiceProc ? undefined : voiceRec ? stopVoice : startVoice} style={[styles.scanBtn, voiceRec && styles.scanBtnRec]} activeOpacity={0.8}>
            {voiceProc ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name={voiceRec ? "stop-circle" : "mic"} size={18} color={voiceRec ? "#fff" : colors.brand} />}
            <Text style={[styles.scanBtnText, voiceRec && { color: "#fff" }]}>{voiceProc ? "Processing..." : voiceRec ? "Stop" : "Voice"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={bulkFromPhoto} disabled={scanning} style={styles.scanBtn} activeOpacity={0.8}>
            {scanning ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="scan-outline" size={18} color={colors.brand} />}
            <Text style={styles.scanBtnText}>{scanning ? "Scanning..." : "Import"}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review extracted items</Text>
              <Text style={styles.modalSub}>{preview.filter((i) => i.selected).length} of {preview.length} selected</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
              {preview.map((it, idx) => {
                const typedPrice = previewPrices[idx];
                const displayPrice = typedPrice !== undefined ? typedPrice : (it.price > 0 ? String(it.price) : "");
                const hasPrice = it.price > 0 && typedPrice === undefined;
                return (
                  <View key={idx} style={[styles.previewRow, !it.selected && styles.previewRowOff]}>
                    <TouchableOpacity
                      onPress={() => setPreview((p) => p.map((x, i) => i === idx ? { ...x, selected: !x.selected } : x))}
                      activeOpacity={0.85}
                      hitSlop={8}
                    >
                      <View style={[styles.checkbox, it.selected && styles.checkboxOn]}>
                        {it.selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                    </TouchableOpacity>
                    {it.photo_url
                      ? <Image source={{ uri: it.photo_url }} style={styles.previewThumb} />
                      : <View style={styles.previewThumbEmpty}><Ionicons name="image-outline" size={16} color={colors.textSubtle} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewName, !it.selected && { color: colors.textMuted }]}>{it.name}</Text>
                      <Text style={styles.previewMeta}>{it.category} · {it.unit || "—"}</Text>
                    </View>
                    {hasPrice ? (
                      <Text style={[styles.previewPrice, !it.selected && { color: colors.textMuted }]}>₹{it.price}</Text>
                    ) : (
                      <View style={styles.previewPriceInput}>
                        <Text style={styles.previewRupee}>₹</Text>
                        <TextInput
                          value={displayPrice}
                          onChangeText={(v) => setPreviewPrices((p) => ({ ...p, [idx]: v }))}
                          keyboardType="numeric"
                          placeholder="price"
                          placeholderTextColor={colors.danger}
                          style={styles.previewPriceField}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setPreviewOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmBulk} disabled={bulkSaving} style={[styles.confirmBulkBtn, bulkSaving && { opacity: 0.6 }]}>
                {bulkSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBulkText}>Add {preview.filter((i) => i.selected).length} items</Text>}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
          <Text style={styles.section}>Add new item</Text>
          <View style={styles.card}>
            <TouchableOpacity onPress={() => pickItemPhoto((url) => setForm((f) => ({ ...f, photo_url: url })))} style={styles.photoPicker} activeOpacity={0.8}>
              {form.photo_url
                ? <Image source={{ uri: form.photo_url }} style={styles.photoThumb} />
                : <View style={styles.photoPlaceholder}><Ionicons name="camera" size={24} color={colors.brand} /><Text style={styles.photoHint}>Add photo</Text></View>}
            </TouchableOpacity>
            <Field label="Name" v={form.name} onChange={(v: string) => setForm({ ...form, name: v })} testID="cat-name" />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><Field label="Price (₹)" v={form.price} onChange={(v: string) => setForm({ ...form, price: v })} testID="cat-price" kb="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Unit" v={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} testID="cat-unit" /></View>
            </View>
            <Field label="Category" v={form.category} onChange={(v: string) => setForm({ ...form, category: v })} testID="cat-category" />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <TouchableOpacity testID="add-catalog-btn" onPress={addItem} disabled={saving} style={[styles.primaryBtn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Add Item</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>All items</Text>
          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="pricetags-outline" size={40} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No items yet. Add your first!</Text>
            </View>
          ) : items.map((it) => editing === it.id ? (
            <View key={it.id} style={styles.card} testID={`edit-card-${it.id}`}>
              <TouchableOpacity onPress={() => pickItemPhoto((url) => setEditForm((f) => ({ ...f, photo_url: url })))} style={styles.photoPicker} activeOpacity={0.8}>
                {editForm.photo_url
                  ? <Image source={{ uri: editForm.photo_url }} style={styles.photoThumb} />
                  : <View style={styles.photoPlaceholder}><Ionicons name="camera" size={24} color={colors.brand} /><Text style={styles.photoHint}>Change photo</Text></View>}
              </TouchableOpacity>
              <Field label="Name" v={editForm.name} onChange={(v: string) => setEditForm({ ...editForm, name: v })} testID={`edit-name-${it.id}`} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}><Field label="Price" v={editForm.price} onChange={(v: string) => setEditForm({ ...editForm, price: v })} testID={`edit-price-${it.id}`} kb="numeric" /></View>
                <View style={{ flex: 1 }}><Field label="Unit" v={editForm.unit} onChange={(v: string) => setEditForm({ ...editForm, unit: v })} testID={`edit-unit-${it.id}`} /></View>
              </View>
              <Field label="Category" v={editForm.category} onChange={(v: string) => setEditForm({ ...editForm, category: v })} testID={`edit-cat-${it.id}`} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity testID={`save-edit-${it.id}`} onPress={saveEdit} style={[styles.primaryBtn, { flex: 1 }]}><Text style={styles.primaryBtnText}>Save</Text></TouchableOpacity>
                <TouchableOpacity testID={`cancel-edit-${it.id}`} onPress={() => setEditing(null)} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View key={it.id} style={[styles.itemCard, !it.in_stock && { opacity: 0.6 }]} testID={`item-card-${it.id}`}>
              {it.photo_url
                ? <Image source={{ uri: it.photo_url }} style={styles.itemThumb} />
                : <View style={styles.itemThumbPlaceholder}><Ionicons name="image-outline" size={22} color={colors.textSubtle} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>{it.category || "Other"} · {it.unit || "—"}</Text>
                <Text style={styles.itemPrice}>₹{it.price.toFixed(0)}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity testID={`toggle-stock-${it.id}`} onPress={() => toggleStock(it)} style={[styles.stockBtn, !it.in_stock && styles.stockBtnOff]}>
                  <Text style={[styles.stockBtnText, !it.in_stock && { color: colors.danger }]}>{it.in_stock ? "In stock" : "Out of stock"}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <TouchableOpacity testID={`edit-${it.id}`} onPress={() => startEdit(it)} style={styles.iconBtn}><Ionicons name="create-outline" size={18} color={colors.brandDark} /></TouchableOpacity>
                  <TouchableOpacity testID={`delete-${it.id}`} onPress={() => deleteItem(it.id)} style={styles.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.danger} /></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, v, onChange, testID, kb }: any) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} value={v} onChangeText={onChange} keyboardType={kb || "default"} style={styles.input} placeholderTextColor={colors.textSubtle} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, height: 60 },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { ...font.h2, color: colors.text },
  sub: { ...font.small, color: colors.textMuted },
  section: { ...font.h3, color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  label: { ...font.small, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...font.body, color: colors.text },
  err: { color: colors.danger, ...font.small, marginBottom: spacing.sm },
  primaryBtn: { backgroundColor: colors.brand, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryBtnText: { color: "#fff", ...font.body, fontWeight: "800" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  secondaryBtnText: { color: colors.text, fontWeight: "700" },
  itemCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemThumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.bg },
  itemThumbPlaceholder: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  photoPicker: { alignSelf: "center", marginBottom: spacing.md },
  photoThumb: { width: 100, height: 100, borderRadius: radius.lg, backgroundColor: colors.bg },
  photoPlaceholder: { width: 100, height: 100, borderRadius: radius.lg, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderColor: colors.brand, borderStyle: "dashed" },
  photoHint: { ...font.small, color: colors.brand, fontWeight: "700" },
  itemName: { ...font.body, color: colors.text, fontWeight: "700" },
  itemMeta: { ...font.small, color: colors.textSubtle, marginTop: 2 },
  itemPrice: { ...font.body, color: colors.brandDark, fontWeight: "800", marginTop: 4 },
  actions: { alignItems: "flex-end" },
  stockBtn: { paddingHorizontal: 12, height: 28, borderRadius: radius.pill, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  stockBtnOff: { backgroundColor: "#FEF2F2" },
  stockBtnText: { fontSize: 11, color: colors.brandDark, fontWeight: "800", letterSpacing: 0.3 },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  emptyBox: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  emptyText: { ...font.body, color: colors.textMuted },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: "#ECFDF5" },
  scanBtnRec: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  scanBtnText: { ...font.small, color: colors.brand, fontWeight: "700" },
  modalHeader: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...font.h2, color: colors.text },
  modalSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, marginBottom: spacing.sm },
  previewRowOff: { borderColor: colors.border, backgroundColor: colors.bg },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  previewThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  previewThumbEmpty: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  previewName: { ...font.body, color: colors.text, fontWeight: "700" },
  previewMeta: { ...font.small, color: colors.textSubtle, marginTop: 2 },
  previewPrice: { ...font.body, color: colors.brandDark, fontWeight: "800" },
  previewPriceInput: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.sm, height: 36, overflow: "hidden" },
  previewRupee: { paddingHorizontal: 6, ...font.body, color: colors.text, fontWeight: "700" },
  previewPriceField: { width: 60, height: 36, ...font.body, color: colors.text, paddingRight: 6 },
  modalFooter: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: spacing.md, padding: spacing.lg, backgroundColor: "#FFFFFFEE", borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { ...font.body, color: colors.text, fontWeight: "700" },
  confirmBulkBtn: { flex: 2, height: 48, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  confirmBulkText: { color: "#fff", ...font.body, fontWeight: "800" },
});
