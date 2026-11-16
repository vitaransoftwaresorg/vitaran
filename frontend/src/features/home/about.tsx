import { BrandBars } from "@/components/shared/logo";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { pillars } from "./content";

export function About() {
  return (
    <section id="about" className="relative overflow-hidden border-t border-[#ede9fe] bg-[#faf8ff] py-14 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-[rgb(124_58_237/0.08)] blur-3xl"
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:gap-16 sm:px-8 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Who we are"
            title={
              <>
                Innovation meets expertise to produce{" "}
                <span className="text-gradient-dark">impactful solutions</span>
              </>
            }
            description="We are an educational content and curriculum development company. Our subject experts, instructional designers, writers and artists create learning material that is accurate, engaging and built to last."
          />

          <div className="mt-6 space-y-2 sm:mt-10 sm:space-y-3">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 90}>
                <div className="group flex items-center gap-3 rounded-2xl border border-transparent bg-white/70 p-3 shadow-[0_8px_30px_-24px_rgb(25_28_95/0.35)] transition-all hover:border-brand-100 hover:bg-white sm:items-start sm:gap-4 sm:p-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white shadow-lg shadow-brand-900/20 transition-transform group-hover:scale-105 sm:size-12 sm:rounded-2xl">
                    <pillar.icon className="size-4.5 sm:size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-brand-950 sm:text-lg">
                      {pillar.title}
                    </h3>
                    <p className="mt-1 hidden leading-relaxed text-brand-500 sm:block">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="relative hidden sm:block">
          <div className="relative aspect-4/5 overflow-hidden rounded-[2.5rem] border border-brand-100 bg-white shadow-[0_30px_80px_-40px_rgb(25_28_95/0.45)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(167_139_250/0.25),transparent_45%),radial-gradient(circle_at_80%_80%,rgb(192_38_211/0.12),transparent_40%)]" />
            <BrandBars className="absolute inset-x-[22%] top-[18%] bottom-0 text-brand-800" />
          </div>

          <div className="absolute -bottom-6 -left-2 max-w-60 rounded-2xl border border-brand-100 bg-white p-4 shadow-[0_30px_60px_-20px_rgb(25_28_95/0.35)] sm:-left-8 sm:max-w-xs sm:p-6">
            <p className="font-heading text-base leading-snug font-semibold text-brand-950 sm:text-lg">
              &ldquo;Excellence is not just what we create. It&apos;s the impact
              we create.&rdquo;
            </p>
            <p className="mt-2 text-xs text-brand-500 sm:mt-3 sm:text-sm">
              Our mission at Vitaran
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
