import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { processSteps } from "./content";

export function Process() {
  return (
    <section id="process" className="relative bg-brand-50 py-10 sm:py-32">
      <div className="bg-grid-light absolute inset-0 mask-[radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How we work"
          title="A proven process from idea to impact"
          description="Cross-disciplinary collaboration at every step keeps risk low and quality high."
        />

        <div className="relative mt-8 sm:mt-20">
          <div
            aria-hidden
            className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-linear-to-r from-brand-800 via-brand-400 to-brand-200 lg:block"
          />
          <ol className="relative grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-10 lg:grid-cols-4 lg:gap-6">
            {processSteps.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={i * 120} className="text-center">
                  <div className="relative mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-800 text-white shadow-xl shadow-brand-800/25 ring-6 ring-brand-50 sm:size-14 sm:rounded-2xl sm:ring-8">
                    <step.icon className="size-5 sm:size-6" />
                    <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-white text-[0.65rem] font-bold text-brand-800 shadow sm:size-6 sm:text-xs">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-brand-900 sm:mt-6 sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-2 hidden max-w-xs leading-relaxed text-muted-foreground sm:block">
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
