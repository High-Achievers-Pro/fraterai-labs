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
      <head>
        {/* Matches app/(marketing)/layout.tsx — globals.css hardcodes
            'Outfit' in several rules, and without this link portal pages
            silently fell back to system-ui after the route-group split
            gave the portal its own root layout. See final-review.md M2. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
