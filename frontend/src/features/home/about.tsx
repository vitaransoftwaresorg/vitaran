import { BrandBars } from "@/components/shared/logo";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { pillars } from "./content";

export function About() {
  return (
    <section id="about" className="relative py-10 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:gap-16 sm:px-8 lg:grid-cols-2 lg:items-center">
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

          <div className="mt-4 space-y-1 sm:mt-12 sm:space-y-4">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 100}>
                <div className="group flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-all hover:border-brand-100 hover:bg-brand-50/60 sm:items-start sm:gap-5 sm:p-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-white shadow-lg shadow-brand-800/20 transition-transform group-hover:scale-105 sm:size-12">
                    <pillar.icon className="size-4.5 sm:size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-brand-900 sm:text-lg">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 hidden leading-relaxed text-muted-foreground sm:block">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="relative hidden sm:block">
          <div className="bg-grid-light relative aspect-square overflow-hidden rounded-3xl bg-brand-50 sm:aspect-4/5 sm:rounded-[2.5rem]">
            <div className="absolute inset-0 bg-linear-to-br from-brand-100/0 via-brand-100/40 to-brand-300/40" />
            <BrandBars className="absolute inset-x-[22%] top-[18%] bottom-0 text-brand-800" />
          </div>

          <div className="absolute -bottom-6 -left-2 max-w-60 rounded-2xl border border-brand-100 bg-white p-4 shadow-[0_30px_60px_-20px_rgb(25_28_95/0.35)] sm:-left-10 sm:max-w-xs sm:p-6">
            <p className="font-heading text-base leading-snug font-semibold text-brand-900 sm:text-lg">
              &ldquo;Excellence is not just what we create. It&apos;s the impact
              we create.&rdquo;
            </p>
            <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
              Our mission at Vitaran
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
