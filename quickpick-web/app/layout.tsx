import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuickPick — Skip the Queue",
  description: "Pre-order from local shops. No waiting, no delivery fees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
