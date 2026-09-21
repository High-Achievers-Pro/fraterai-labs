import type { Metadata } from "next";
import "@/app/marketing.css";
import { Libre_Caslon_Display, DM_Sans } from "next/font/google";
import Navbar from "@/components/global/Navbar";
import Footer from "@/components/global/Footer";
import ScrollRevealProvider from "@/components/global/ScrollRevealProvider";
import { CalendlyProvider } from "@/components/calendly/CalendlyContext";
import CalendlyModal from "@/components/calendly/CalendlyModal";

const display = Libre_Caslon_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const socialTitle = "FraterAI — Your next business advantage, built with AI.";
const description =
  "Strategic clarity, operator-level expertise, and disciplined engineering. We turn AI and machine learning into measurable progress for your business.";
const socialImage = {
  url: "https://www.fraterailabs.com/social/fraterai-preview-v2.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "FraterAI — Your next business advantage, built with AI. Blue architectural engraving on warm paper.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fraterailabs.com"),
  title: "FraterAI",
  description,
  openGraph: {
    title: socialTitle,
    description,
    url: "https://www.fraterailabs.com",
    siteName: "FraterAI",
    locale: "en_US",
    type: "website",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description,
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>
        <a href="#top" className="skip-link">
          Skip to content
        </a>
        <CalendlyProvider>
          <ScrollRevealProvider>
            <Navbar />
            {children}
            <Footer />
          </ScrollRevealProvider>
          <CalendlyModal />
        </CalendlyProvider>
      </body>
    </html>
  );
}
