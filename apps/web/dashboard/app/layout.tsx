import type { Metadata } from "next";
import { AppProviders } from "@/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Slaivio - Cargo OS",
    template: "%s | Slaivio",
  },
  description: "Enterprise cargo operations platform for agencies.",
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
      },
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/slaivio-icon-official.png",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
