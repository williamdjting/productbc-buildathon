import type { Metadata } from "next";
import { Syne, DM_Sans, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Content Ready",
  description: "Optimize your content for AI search engines — AEO + GEO analysis and rewriting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${dmSans.variable} ${bricolage.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
