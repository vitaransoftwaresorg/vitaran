import type { Metadata } from "next";
import "./globals.css";
import { Geist, Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vitaran Learning — Educational content & curriculum development",
    template: "%s · Vitaran Learning",
  },
  description:
    "Curriculum and course development, e-learning content, instructional design, assessment, and art & production for K-12, corporates and industries.",
  icons: { icon: "/brand/vitaran-logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn("font-sans antialiased", geist.variable, jakarta.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
