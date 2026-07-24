export const colors = {
  brand: "#10B981",
  brandDark: "#047857",
  accent: "#EA580C",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  textSubtle: "#64748B",
  border: "#E2E8F0",
  submitted: "#3B82F6",
  awaiting_payment: "#8B5CF6",
  packaging: "#F59E0B",
  ready: "#10B981",
  completed: "#047857",
  outOfStock: "#EF4444",
  danger: "#EF4444",
  black: "#0F172A",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const font = {
  h1: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  small: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 1, textTransform: "uppercase" as const },
};

export const statusColor = (s: string) => {
  switch (s) {
    case "submitted": return colors.submitted;
    case "awaiting_payment": return colors.awaiting_payment;
    case "packaging": return colors.packaging;
    case "ready": return colors.ready;
    case "completed": return colors.completed;
    case "cancelled": return colors.danger;
    default: return colors.textSubtle;
  }
};

export const statusLabel = (s: string) => {
  switch (s) {
    case "submitted": return "Order Placed";
    case "awaiting_payment": return "Awaiting Payment";
    case "packaging": return "Packaging";
    case "ready": return "Ready for Pickup";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return s;
  }
};
