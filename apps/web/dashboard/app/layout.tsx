import type { Metadata } from "next";
import { AppProviders } from "@/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SLAIVIO Cargo OS",
    template: "%s | SLAIVIO",
  },
  description: "Enterprise cargo operations platform for agencies.",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/icon.png",
        type: "image/png",
      },
    ],
    apple: "/apple-icon.png",
  },
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
