import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { colors, font, spacing, radius } from "@/src/theme";
import { api, Shop } from "@/src/api";
import { MapPickerModal } from "@/src/components/MapPickerModal";

type FormState = { name: string; category: string; description: string; address: string; lat: number; lng: number; photo_url: string; upi_id: string; hours: string };
const BLANK: FormState = { name: "", category: "Grocery", description: "", address: "", lat: 12.9716, lng: 77.5946, photo_url: "", upi_id: "", hours: "9:00 AM – 9:00 PM" };

export default function MyShop() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [form, setForm] = useState<FormState>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  // Edit modal
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...BLANK });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editMapOpen, setEditMapOpen] = useState(false);
  const [editFetchingLoc, setEditFetchingLoc] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ shops: Shop[] }>("/shops/mine/list");
      setShops(data.shops);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]));

  // --- Image picker (shared for add + edit) ---
  const pickImage = async (target: "add" | "edit") => {
    Alert.alert("Shop photo", "Choose source", [
      { text: "Camera", onPress: () => doPickImage(target, true) },
      { text: "Gallery", onPress: () => doPickImage(target, false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const doPickImage = async (target: "add" | "edit", fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Camera access needed"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true, allowsEditing: true, aspect: [16, 9] });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true, allowsEditing: true, aspect: [16, 9] });
      }
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      if (target === "add") setForm((f) => ({ ...f, photo_url: dataUri }));
      else setEditForm((f) => ({ ...f, photo_url: dataUri }));
    } catch { Alert.alert("Error", "Could not pick image."); }
  };

  // --- Add location ---
  const useMyLocation = async (target: "add" | "edit") => {
    const setFetching = target === "add" ? setFetchingLoc : setEditFetchingLoc;
    const setF = target === "add" ? setForm : setEditForm;
    setFetching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const address = [geo?.street, geo?.district, geo?.city, geo?.region].filter(Boolean).join(", ");
      setF((f) => ({ ...f, lat: loc.coords.latitude, lng: loc.coords.longitude, address: address || f.address }));
    } finally { setFetching(false); }
  };

  // --- Add shop ---
  const save = async () => {
    setErr(""); setOk("");
    if (!form.name || !form.address) { setErr("Name and address are required"); return; }
    setSaving(true);
    try {
      await api.post("/shops", { ...form });
      setOk("Shop submitted for admin approval!");
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  // --- Edit shop ---
  const openEdit = (s: Shop) => {
    setEditShop(s);
    setEditForm({ name: s.name, category: s.category, description: s.description, address: s.address, lat: s.lat, lng: s.lng, photo_url: s.photo_url, upi_id: s.upi_id, hours: s.hours });
    setEditErr("");
  };

  const saveEdit = async () => {
    if (!editShop) return;
    setEditErr("");
    if (!editForm.name || !editForm.address) { setEditErr("Name and address are required"); return; }
    setEditSaving(true);
    try {
      await api.patch(`/shops/${editShop.id}`, { ...editForm });
      setEditShop(null);
      await load();
    } catch (e: any) {
      setEditErr(e?.response?.data?.detail || "Failed to update");
    } finally { setEditSaving(false); }
  };

  // --- Delete shop ---
  const confirmDelete = (s: Shop) => {
    Alert.alert(
      "Delete shop",
      `Delete "${s.name}"? This will also delete all catalog items. Orders history is kept.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete(s.id) },
      ],
    );
  };

  const doDelete = async (id: string) => {
    try {
      await api.delete(`/shops/${id}`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to delete shop");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>My Shops</Text>

          {loading ? <ActivityIndicator color={colors.brand} /> : (
            shops.length === 0
              ? <Text style={styles.empty}>No shops yet. Add your first shop below.</Text>
              : shops.map((s) => (
                <View key={s.id} style={styles.card}>
                  {s.photo_url ? <Image source={{ uri: s.photo_url }} style={styles.cardImage} /> : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                      <Ionicons name="storefront-outline" size={32} color={colors.textSubtle} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{s.name}</Text>
                    <Text style={styles.cardMeta}>{s.category} · {s.address}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: s.status === "approved" ? "#ECFDF5" : "#FEF3C7" }]}>
                        <Text style={[styles.badgeText, { color: s.status === "approved" ? colors.brandDark : "#B45309" }]}>{s.status.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: s.is_open ? "#ECFDF5" : "#FEF2F2" }]}>
                        <Text style={[styles.badgeText, { color: s.is_open ? colors.brandDark : colors.danger }]}>{s.is_open ? "OPEN" : "CLOSED"}</Text>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        testID={`manage-catalog-${s.id}`}
                        onPress={() => router.push({ pathname: "/(shopkeeper)/catalog/[shopId]", params: { shopId: s.id } })}
                        style={styles.actionBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="pricetags-outline" size={15} color={colors.brand} />
                        <Text style={styles.actionBtnText}>Catalog</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEdit(s)} style={styles.actionBtn} activeOpacity={0.85}>
                        <Ionicons name="create-outline" size={15} color={colors.brandDark} />
                        <Text style={[styles.actionBtnText, { color: colors.brandDark }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(s)} style={[styles.actionBtn, styles.actionBtnDanger]} activeOpacity={0.85}>
                        <Ionicons name="trash-outline" size={15} color={colors.danger} />
                        <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
          )}

          <Text style={styles.section}>Add a new shop</Text>
          <ShopForm
            form={form}
            setForm={setForm}
            onPickImage={() => pickImage("add")}
            onMyLocation={() => useMyLocation("add")}
            fetchingLoc={fetchingLoc}
            onOpenMap={() => setMapOpen(true)}
          />
          <MapPickerModal
            visible={mapOpen}
            initial={{ lat: form.lat, lng: form.lng }}
            onConfirm={(loc, address) => { setForm((f) => ({ ...f, lat: loc.lat, lng: loc.lng, address: address || f.address })); setMapOpen(false); }}
            onClose={() => setMapOpen(false)}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          {ok ? <Text style={styles.ok}>{ok}</Text> : null}
          <TouchableOpacity testID="save-shop-btn" onPress={save} disabled={saving} style={[styles.cta, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Submit Shop</Text>}
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: spacing.md }}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textSubtle} />
            <Text style={styles.hint}>New shops are reviewed by admin before going live.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Edit Modal */}
      <Modal visible={!!editShop} animationType="slide" onRequestClose={() => setEditShop(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditShop(null)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Shop</Text>
            <View style={{ width: 40 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              <ShopForm
                form={editForm}
                setForm={setEditForm}
                onPickImage={() => pickImage("edit")}
                onMyLocation={() => useMyLocation("edit")}
                fetchingLoc={editFetchingLoc}
                onOpenMap={() => setEditMapOpen(true)}
              />
              <MapPickerModal
                visible={editMapOpen}
                initial={{ lat: editForm.lat, lng: editForm.lng }}
                onConfirm={(loc, address) => { setEditForm((f) => ({ ...f, lat: loc.lat, lng: loc.lng, address: address || f.address })); setEditMapOpen(false); }}
                onClose={() => setEditMapOpen(false)}
              />
              {editErr ? <Text style={styles.err}>{editErr}</Text> : null}
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={() => setEditShop(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} disabled={editSaving} style={[styles.cta, { flex: 2 }, editSaving && { opacity: 0.6 }]}>
              {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Save changes</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ShopForm({ form, setForm, onPickImage, onMyLocation, fetchingLoc, onOpenMap }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onPickImage: () => void;
  onMyLocation: () => void;
  fetchingLoc: boolean;
  onOpenMap: () => void;
}) {
  return (
    <>
      {/* Photo */}
      <Text style={styles.label}>Photo</Text>
      <TouchableOpacity onPress={onPickImage} style={styles.photoPicker} activeOpacity={0.85}>
        {form.photo_url ? (
          <Image source={{ uri: form.photo_url }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={28} color={colors.textSubtle} />
            <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
          </View>
        )}
        <View style={styles.photoOverlay}>
          <Ionicons name="camera" size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      <Field label="Shop name" v={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} testID="shop-name" />
      <Field label="Category" v={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} testID="shop-category" />
      <Field label="Address" v={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} testID="shop-address" multiline />

      <Text style={styles.label}>Location</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <TouchableOpacity onPress={onOpenMap} style={styles.locBtn} activeOpacity={0.8}>
          <Ionicons name="map-outline" size={16} color={colors.brand} />
          <Text style={styles.locBtnText}>Pick on map</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMyLocation} disabled={fetchingLoc} style={styles.locBtn} activeOpacity={0.8}>
          {fetchingLoc ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="locate" size={16} color={colors.brand} />}
          <Text style={styles.locBtnText}>My location</Text>
        </TouchableOpacity>
      </View>
      {(form.lat !== 12.9716 || form.lng !== 77.5946) ? (
        <View style={styles.coordBadge}>
          <Ionicons name="location" size={13} color={colors.brand} />
          <Text style={styles.coordText}>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</Text>
        </View>
      ) : null}

      <Field label="UPI ID" v={form.upi_id} onChange={(v) => setForm((f) => ({ ...f, upi_id: v }))} testID="shop-upi" />
      <Field label="Hours" v={form.hours} onChange={(v) => setForm((f) => ({ ...f, hours: v }))} testID="shop-hours" />
      <Field label="Description" v={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} testID="shop-desc" multiline />
    </>
  );
}

function Field({ label, v, onChange, testID, multiline, kb }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} value={v} onChangeText={onChange} multiline={!!multiline} keyboardType={kb || "default"} style={[styles.input, multiline && { minHeight: 60, textAlignVertical: "top" }]} placeholderTextColor={colors.textSubtle} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { ...font.h1, color: colors.text, marginBottom: spacing.md },
  empty: { ...font.body, color: colors.textMuted },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: "hidden" },
  cardImage: { width: "100%", height: 140 },
  cardImagePlaceholder: { backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  cardBody: { padding: spacing.md },
  cardTitle: { ...font.h3, color: colors.text },
  cardMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  badge: { paddingHorizontal: 8, height: 22, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  cardActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: spacing.md, backgroundColor: "#ECFDF5", borderRadius: radius.pill },
  actionBtnDanger: { backgroundColor: "#FEF2F2" },
  actionBtnText: { color: colors.brand, ...font.small, fontWeight: "700" },
  section: { ...font.h3, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  label: { ...font.small, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, ...font.body, color: colors.text },
  err: { color: colors.danger, ...font.small, marginTop: spacing.sm },
  ok: { color: colors.brandDark, ...font.small, marginTop: spacing.sm },
  cta: { backgroundColor: colors.brand, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  ctaText: { color: "#fff", ...font.h3 },
  hint: { ...font.small, color: colors.textSubtle },
  locBtn: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.card, justifyContent: "center" },
  locBtnText: { ...font.small, color: colors.brand, fontWeight: "700" },
  coordBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md, padding: spacing.sm, backgroundColor: "#ECFDF5", borderRadius: radius.md },
  coordText: { ...font.small, color: colors.brandDark, fontFamily: "monospace" },
  photoPicker: { borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, position: "relative" },
  photoPreview: { width: "100%", height: 180 },
  photoPlaceholder: { width: "100%", height: 180, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  photoPlaceholderText: { ...font.small, color: colors.textSubtle },
  photoOverlay: { position: "absolute", bottom: spacing.sm, right: spacing.sm, width: 36, height: 36, borderRadius: radius.pill, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, height: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalClose: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  modalTitle: { ...font.h3, color: colors.text },
  modalFooter: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  cancelBtn: { flex: 1, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { ...font.body, color: colors.text, fontWeight: "700" },
});
