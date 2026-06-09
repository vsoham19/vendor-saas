import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers"; // Import the core framework bundle

export const metadata: Metadata = {
  title: "Artisan Ledger | The Atelier Dashboard",
  description: "Boutique Billing, Appointments & Custom Measurement Management SaaS",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
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