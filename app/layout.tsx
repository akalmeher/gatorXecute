import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Header } from "@/components/shell/Header";
import { DemoFlowNav } from "@/components/shell/DemoFlowNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "gatorXecute | SFSU Hackathon MVP",
  description: "AI-assisted group project coordination tool for SFSU students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50/50 text-zinc-900 antialiased">
        <AppProviders>
          <div className="min-h-screen flex flex-col">
            <Header />
            <DemoFlowNav />
            <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500">
              gatorXecute • SFSU AI Hackathon MVP • Built by Ammar, Divij, Oscar &amp; Shreya
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
