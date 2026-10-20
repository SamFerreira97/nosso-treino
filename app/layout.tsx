import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nosso Treino — Evoluindo juntos",
  description: "Treino em dupla com ficha real e sincronização privada.",
  icons: {
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
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
