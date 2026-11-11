import Link from "next/link";
import { Briefcase, Mail, MapPin, Phone } from "lucide-react";
import { BrandBars, Logo } from "@/components/shared/logo";
import { contactDetails, offices } from "@/features/contact/content";
import { navLinks, services } from "@/features/home/content";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-brand-950 text-brand-200">
      <BrandBars className="pointer-events-none absolute -right-10 -bottom-10 h-72 w-64 text-brand-800/60" />

      <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-10 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="white" />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-brand-300">
              Transforming the way of learning through expert-led innovation for
              corporates, industries and K-12.
            </p>
          </div>

          <FooterColumn title="Company">
            {navLinks.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Services">
            {services.slice(0, 6).map((service) => (
              <FooterLink key={service.title} href="#services">
                {service.title}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Get in touch">
            <li className="flex items-start gap-2 text-sm leading-relaxed">
              <MapPin className="mt-1 size-4 shrink-0 text-brand-400" />
              <span>{offices[0].address}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <Link href={`mailto:${contactDetails.email}`} className="hover:text-white">
                {contactDetails.email}
              </Link>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <Link href={contactDetails.phoneHref} className="hover:text-white">
                {contactDetails.phone}
              </Link>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <Briefcase className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <Link href="/#careers" className="hover:text-white">
                Join our team
              </Link>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-brand-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Vitaran Learning. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/contact" className="hover:text-white">
              Terms &amp; Conditions
            </Link>
            <Link href="/contact" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href.startsWith("#") ? `/${href}` : href}
        className="text-sm transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}
