import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { contactDetails, offices } from "./content";

export function ContactDetails() {
  return (
    <div className="space-y-4">
      {offices.map((office) => (
        <DetailCard key={office.label} icon={MapPin} title={office.label}>
          {office.address}
        </DetailCard>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard icon={Mail} title="Email">
          <Link
            href={`mailto:${contactDetails.email}`}
            className="break-all text-brand-800 hover:text-brand-950"
          >
            {contactDetails.email}
          </Link>
        </DetailCard>
        <DetailCard icon={Phone} title="Phone">
          <Link href={contactDetails.phoneHref} className="text-brand-800 hover:text-brand-950">
            {contactDetails.phone}
          </Link>
        </DetailCard>
      </div>

      <DetailCard icon={Clock} title="Working Hours">
        {contactDetails.workingHours}
      </DetailCard>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-brand-100 bg-[#f8f7ff] p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-brand-950">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-brand-500">{children}</div>
      </div>
    </div>
  );
}
