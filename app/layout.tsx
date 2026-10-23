import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SFS Warehouse | Operations workspace",
  description: "Staffing, inventory, fulfillment, and parcel operations in one workspace.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SFS Warehouse", statusBarStyle: "default" },
  icons: {
    apple: "/icons/app-192.png",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
