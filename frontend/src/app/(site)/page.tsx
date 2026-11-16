import dynamic from "next/dynamic";
import { Hero } from "@/features/home/hero";

/** Below-fold marketing blocks — load after the hero paints. */
const Services = dynamic(
  () => import("@/features/home/services").then((m) => ({ default: m.Services })),
  { loading: () => <div className="min-h-[28rem] bg-white" aria-hidden /> },
);
const WhyVitaran = dynamic(
  () => import("@/features/home/why-vitaran").then((m) => ({ default: m.WhyVitaran })),
  { loading: () => <div className="min-h-[28rem] bg-[#f3f0fa]" aria-hidden /> },
);
const SchoolsMarquee = dynamic(
  () => import("@/features/home/schools-marquee").then((m) => ({ default: m.SchoolsMarquee })),
  { loading: () => <div className="min-h-[12rem] bg-white" aria-hidden /> },
);
const Contact = dynamic(
  () => import("@/features/home/contact").then((m) => ({ default: m.Contact })),
  { loading: () => <div className="min-h-[16rem] bg-white" aria-hidden /> },
);

/** Marketing landing — hero is server-rendered for an instant first paint. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <WhyVitaran />
      <SchoolsMarquee />
      <Contact />
    </>
  );
}
