import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { processSteps } from "./content";

export function Process() {
  return (
    <section id="process" className="relative overflow-hidden bg-white py-14 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgb(192_38_211/0.06),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How we work"
          title={
            <>
              A proven process from idea to{" "}
              <span className="text-gradient-dark">impact</span>
            </>
          }
          description="Cross-disciplinary collaboration at every step keeps risk low and quality high."
        />

        <div className="relative mt-8 sm:mt-16">
          <div
            aria-hidden
            className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-linear-to-r from-accent-violet via-brand-300 to-accent-pink lg:block"
          />
          <ol className="relative grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-10 lg:grid-cols-4 lg:gap-6">
            {processSteps.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={i * 100} className="text-center">
                  <div className="relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-900 text-white shadow-xl shadow-brand-900/25 ring-6 ring-white sm:size-14 sm:ring-8">
                    <step.icon className="size-5 sm:size-6" />
                    <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#c026d3)] text-[0.65rem] font-bold text-white shadow sm:size-6 sm:text-xs">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-brand-950 sm:mt-6 sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-2 hidden max-w-xs leading-relaxed text-brand-500 sm:block">
                    {step.description}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
