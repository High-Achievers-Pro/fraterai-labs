import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Frater Portal",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
