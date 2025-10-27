import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VoteFHE - Private Voting Platform",
  description:
    "Decentralized voting platform with FHE technology, ensuring absolute privacy and transparency.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#0F0F23] text-foreground antialiased font-inter">
        <Providers>
          <NavigationWrapper />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
