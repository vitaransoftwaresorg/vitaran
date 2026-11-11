import { ArrowUpRight, Check } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";
import { audiences, services } from "./content";

const audienceTones = [
  "bg-brand-800 text-white ring-1 ring-white/10",
  "bg-brand-600 text-white",
  "bg-white text-brand-900",
];

export function Services() {
  return (
    <section
      id="services"
      className="relative overflow-hidden bg-brand-950 py-10 text-white sm:py-32"
    >
      <div className="bg-grid absolute inset-0 mask-[linear-gradient(to_bottom,black,transparent)]" />
      <div className="absolute top-1/3 -left-40 size-120 rounded-full bg-brand-700/40 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          tone="dark"
          eyebrow="Our services"
          title="Educational content crafted by experts"
          description="One partner for the entire journey, from the first learning objective to finished, classroom-ready content."
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 lg:grid-cols-3">
          {services.map((service, i) => (
            <Reveal
              key={service.title}
              delay={(i % 3) * 80}
              className={cn(i === 0 && "col-span-2")}
            >
              <article
                className={cn(
                  "group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/8 sm:rounded-3xl sm:p-7",
                  i === 0 &&
                    "bg-linear-to-br from-brand-700/60 to-white/4 sm:p-10",
                )}
              >
                <div className="absolute -top-16 -right-16 size-40 rounded-full bg-glow/0 blur-3xl transition-colors duration-500 group-hover:bg-glow/25" />
                <div className="relative flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white text-brand-800 sm:size-12 sm:rounded-2xl">
                    <service.icon className="size-4.5 sm:size-5" />
                  </div>
                  <ArrowUpRight className="hidden size-5 text-brand-400 sm:block transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
                <h3
                  className={cn(
                    "relative mt-3 text-sm leading-snug font-semibold sm:mt-8 sm:text-lg",
                    i === 0 && "text-base sm:text-2xl",
                  )}
                >
                  {service.title}
                </h3>
                <p
                  className={cn(
                    "relative mt-2 hidden text-sm leading-relaxed text-brand-200/75 sm:block",
                    i === 0 && "max-w-lg sm:text-base",
                  )}
                >
                  {service.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mx-auto mt-10 max-w-2xl text-center sm:mt-24">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-300 uppercase">
            Who we serve
          </p>
          <h3 className="mt-2 text-xl font-bold text-balance sm:mt-3 sm:text-3xl">
            Tailored solutions for every kind of learner
          </h3>
          <p className="mt-3 hidden leading-relaxed text-pretty text-brand-200/80 sm:block">
            Suitable for all types of learners, whether in the boardroom, on the factory floor or in
            the classroom.
          </p>
        </Reveal>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-12 sm:grid-cols-1 sm:gap-6 lg:grid-cols-3">
          {audiences.map((audience, i) => {
            const light = i === 2;
            return (
              <Reveal key={audience.title} delay={i * 120}>
                <article
                  className={cn(
                    "group relative flex h-full flex-col items-center overflow-hidden rounded-2xl p-3 text-center transition-transform sm:items-start sm:text-left duration-300 hover:-translate-y-1.5 sm:rounded-[2rem] sm:p-10",
                    audienceTones[i],
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "absolute -right-6 -bottom-6 hidden h-40 gap-2 sm:flex opacity-15 transition-opacity group-hover:opacity-25 sm:h-40",
                      light ? "text-brand-800" : "text-white",
                    )}
                  >
                    <span className="w-6 rounded-sm bg-current sm:w-8" />
                    <span className="w-6 rounded-sm bg-current opacity-75 sm:w-8" />
                    <span className="w-6 rounded-sm bg-current opacity-50 sm:w-8" />
                  </div>

                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl sm:size-14 sm:rounded-2xl",
                      light ? "bg-brand-800 text-white" : "bg-white/15 text-white",
                    )}
                  >
                    <audience.icon className="size-5 sm:size-6" />
                  </div>
                  <h4 className="mt-2 text-sm font-bold sm:mt-8 sm:text-2xl">{audience.title}</h4>
                  <p
                    className={cn(
                      "mt-3 hidden leading-relaxed sm:block",
                      light ? "text-brand-700" : "text-white/75",
                    )}
                  >
                    {audience.description}
                  </p>
                  <ul className="relative mt-8 hidden space-y-3 sm:block">
                    {audience.points.map((point) => (
                      <li key={point} className="flex items-center gap-3 text-sm font-medium">
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full",
                            light ? "bg-brand-800 text-white" : "bg-white text-brand-800",
                          )}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
