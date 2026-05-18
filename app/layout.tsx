import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/global/Navbar";
import Footer from "@/components/global/Footer";
import ScrollRevealProvider from "@/components/global/ScrollRevealProvider";

export const metadata: Metadata = {
  metadataBase: new URL('https://frater.ai'),
  title: "FraterAI",
  description: "Intelligent agent architectures tailored to your deepest workflows.",
  openGraph: {
    title: "FraterAI",
    description: "Intelligent agent architectures tailored to your deepest workflows.",
    url: "https://frater.ai",
    siteName: "FraterAI",
    images: [
      {
        url: "/src/assets/logo.svg",
        width: 1200,
        height: 630,
        alt: "FraterAI Preview Image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ScrollRevealProvider>
          <Navbar />
          {children}
          <Footer />
        </ScrollRevealProvider>
      </body>
    </html>
  );
}
