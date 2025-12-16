import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootLayoutWrapper } from "@/components/root-layout-wrapper";

export const metadata: Metadata = {
  title: "Shamelesss",
  description: "Admin Panel with Supabase Auth",
  icons: {
    icon: '/assets/app/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
      </body>
    </html>
  );
}

