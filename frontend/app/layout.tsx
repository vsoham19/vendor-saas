import type { Metadata, Viewport } from "next";
import { Inter, Libre_Caslon_Text } from "next/font/google";
import "./global.css";
import Providers from "./provider"; // Import the core framework bundle

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const libreCaslon = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre-caslon",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Artisan Ledger | The Atelier Dashboard",
  description: "Boutique Billing, Appointments & Custom Measurement Management SaaS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`light ${inter.variable} ${libreCaslon.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-on-surface antialiased font-sans">
        {/* React Query cache context handles everything contained within here */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
