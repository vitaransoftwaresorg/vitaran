import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { BrandBars } from "@/components/shared/logo";
import { contactDetails, offices } from "@/features/contact/content";

export function Contact() {
  return (
    <section id="contact" className="px-5 pb-10 sm:px-8 sm:pb-32">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-950 text-white sm:rounded-[2.5rem]">
        <div className="bg-grid absolute inset-0 mask-[radial-gradient(ellipse_at_left,black,transparent_70%)]" />
        <div className="absolute -top-32 -left-32 size-120 rounded-full bg-brand-700/50 blur-[120px]" />
        <BrandBars className="pointer-events-none absolute right-10 bottom-0 hidden h-56 w-44 text-white/10 lg:flex" />

        <div className="relative grid gap-5 p-6 sm:gap-12 sm:p-12 lg:grid-cols-2 lg:p-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-brand-300 uppercase">
              Contact us
            </p>
            <h2 className="mt-3 text-2xl font-bold text-balance sm:mt-4 sm:text-5xl">
              Get in touch with our team.
            </h2>
            <p className="mt-5 hidden max-w-md text-lg leading-relaxed text-brand-200/85 sm:block">
              Partner with us for curriculum, content and assessment solutions
              for your school, institution or organisation.
            </p>
            <Link
              href="/contact"
              className="group mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 transition-all hover:bg-brand-100 active:scale-95 sm:mt-8 sm:px-7 sm:py-3.5"
            >
              Contact us
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <ul className="space-y-3 text-sm sm:space-y-5 sm:text-base lg:pt-8">
            {offices.map((office) => (
              <li key={office.label} className="hidden gap-4 sm:flex">
                <MapPin className="mt-0.5 size-4.5 shrink-0 text-glow sm:mt-1 sm:size-5" />
                <div>
                  <p className="font-semibold">{office.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-200/85 sm:text-sm">
                    {office.address}
                  </p>
                </div>
              </li>
            ))}
            <li className="flex gap-3 sm:gap-4">
              <Mail className="mt-0.5 size-4.5 shrink-0 text-glow sm:size-5" />
              <Link
                href={`mailto:${contactDetails.email}`}
                className="text-brand-100 hover:text-white"
              >
                {contactDetails.email}
              </Link>
            </li>
            <li className="flex gap-3 sm:gap-4">
              <Phone className="mt-0.5 size-4.5 shrink-0 text-glow sm:size-5" />
              <Link
                href={contactDetails.phoneHref}
                className="text-brand-100 hover:text-white"
              >
                {contactDetails.phone}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
