import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Big Boss Idea - Office Energy Monitor",
  description: "Real-time, retro pixel-art office energy monitoring system for team IUT_zerowin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
