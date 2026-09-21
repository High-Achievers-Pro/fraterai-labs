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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fraterailabs.com"),
  title: "FraterAI",
  description:
    "Intelligent agent architectures tailored to your deepest workflows.",
  openGraph: {
    title: "FraterAI",
    description:
      "Intelligent agent architectures tailored to your deepest workflows.",
    url: "https://www.fraterailabs.com",
    siteName: "FraterAI",
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
