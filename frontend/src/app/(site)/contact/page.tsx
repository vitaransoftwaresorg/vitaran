import type { Metadata } from "next";
import { ContactDetails } from "@/features/contact/contact-details";
import { ContactForm } from "@/features/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Vitaran Learning. Offices in Hyderabad and Pune.",
};

export default function ContactPage() {
  return (
    <section className="marketing-glow relative isolate overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">
            Contact
          </p>
          <h1 className="mt-5 text-4xl leading-tight font-extrabold text-brand-950 sm:text-6xl">
            Contact <span className="text-gradient-dark">Us</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-brand-500">
            Partner with us for curriculum, content and assessment solutions for your school,
            institution or organisation.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-8 lg:mt-14 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
          <ContactDetails />
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
