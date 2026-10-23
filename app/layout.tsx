import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import "./globals.css";
import "./workspace.css";
import { ThemeProvider } from "../src/components/ThemeProvider";
import { themeBootstrap } from "../src/lib/theme";

export const metadata: Metadata = {
  title: "GOP · Gestão de presenças",
  description: "Sistema de controle de presenças",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonces sao diferentes em cada resposta, inclusive no primeiro acesso.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
