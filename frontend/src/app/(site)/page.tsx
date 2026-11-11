import { About } from "@/features/home/about";
import { CareersAndResources } from "@/features/home/careers-resources";
import { Contact } from "@/features/home/contact";
import { Hero } from "@/features/home/hero";
import { Process } from "@/features/home/process";
import { Services } from "@/features/home/services";
import { ThemesMarquee } from "@/features/home/themes-marquee";

export default function HomePage() {
  return (
    <>
      <div className="flex flex-col">
        <Hero />
        <ThemesMarquee className="order-first mt-18 sm:order-0 sm:mt-0" />
      </div>
      <About />
      <Services />
      <Process />
      <CareersAndResources />
      <Contact />
    </>
  );
}
