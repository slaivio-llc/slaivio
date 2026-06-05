import type { Metadata } from "next";
import { AppProviders } from "@/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLAIVO Dashboard",
  description: "Cargo Operations Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
