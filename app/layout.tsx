import type { Metadata } from "next";
import { Space_Grotesk, Rubik } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Header } from "@/components/shell/Header";
import { DemoFlowNav } from "@/components/shell/DemoFlowNav";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "gatorXecute • Student Group Projects Made Simple",
  description: "Calm, smart group project coordination for students across all departments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${rubik.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0F1117] text-[#F5F2FA] font-sans antialiased selection:bg-[#B8A6FF]/20 selection:text-[#F5F2FA]">
        <AppProviders>
          <div className="min-h-screen flex flex-col">
            <Header />
            <DemoFlowNav />
            <main className="flex-1 page-container py-8 sm:py-10">
              {children}
            </main>
            <footer className="border-t border-[#2A2E39] bg-[#0F1117] py-6 text-center text-[13px] text-[#AAA5B4]">
              gatorXecute • Student group projects made simple
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
