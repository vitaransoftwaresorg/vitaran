import { Contact } from "@/features/home/contact";
import { Hero } from "@/features/home/hero";
import { Services } from "@/features/home/services";
import { TrustBar } from "@/features/home/trust-bar";

/** Marketing landing — matches the approved desktop/mobile mockups. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Services />
      <Contact />
    </>
  );
}
