import type { Metadata, Viewport } from "next";
import "./global.css";
import Providers from "./provider"; // Import the core framework bundle

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
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
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