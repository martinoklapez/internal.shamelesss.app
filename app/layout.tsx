import type { Metadata } from "next";
import "./globals.css";
import { RootLayoutWrapper } from "@/components/root-layout-wrapper";

export const metadata: Metadata = {
  title: "Shamelesss",
  description: "Admin Panel with Supabase Auth",
  icons: {
    icon: '/assets/app/favicon.ico',
  },
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

