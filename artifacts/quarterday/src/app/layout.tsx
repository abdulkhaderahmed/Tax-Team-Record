import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/nav";

export const metadata: Metadata = {
  title: "Quarterday — Tax Obligations Register",
  description: "In-house tax team system of record",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
