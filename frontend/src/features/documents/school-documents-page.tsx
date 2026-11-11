import { PageHero } from "@/components/shared/page-hero";
import { Reveal } from "@/components/shared/reveal";
import type { PdfDocument } from "@/types/document";
import { SchoolDocuments } from "./school-documents";

type SchoolDocumentsPageProps = {
  title: string;
  highlight: string;
  programIds: string[];
  documents: PdfDocument[];
  noun: string;
  basePath: string;
};

export function SchoolDocumentsPage({ title, highlight, ...listProps }: SchoolDocumentsPageProps) {
  return (
    <>
      <PageHero
        title={
          <>
            {title} <span className="text-gradient">{highlight}</span>
          </>
        }
      />

      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal>
            <SchoolDocuments {...listProps} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
