import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Tasks — матрица Эйзенхауэра",
  description: "Умный менеджер задач: brain dump, разбор ИИ и матрица Эйзенхауэра",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf5" },
    { media: "(prefers-color-scheme: dark)", color: "#101218" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
