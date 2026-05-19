import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../src/components/ThemeProvider";

export const metadata: Metadata = {
  title: "GOP V2",
  description: "Sistema de controle de presenças",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
