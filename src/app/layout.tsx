import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Inspecciones de laboratorio",
  description: "Registro de mantenimiento para trabajar con conectividad intermitente",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3156d3"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

