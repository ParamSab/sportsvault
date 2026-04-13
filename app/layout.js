import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata = {
  title: "SportsVault — Find Players. Join Games. Build Your Rep.",
  description: "Hyperlocal sports social platform for football, padel, and cricket. Connect with nearby players, join pickup games, and build your sporting reputation.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
