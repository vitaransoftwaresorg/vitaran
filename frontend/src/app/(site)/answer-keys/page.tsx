import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHero } from "@/components/shared/page-hero";
import { Reveal } from "@/components/shared/reveal";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { PortalAnswerKeysDrive } from "@/features/answer-keys/portal-answer-keys-drive";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { programs } from "@/features/teachers-resources/content";
import { listPublicAnswerKeys } from "@/services/answer-keys";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Answer Keys",
  description:
    "Answer keys for the Integrated, Advanced, Revised Advanced and Olympiad programs.",
};

export default async function AnswerKeysPage() {
  const { answerKeysPublic } = await getPublicSettings();
  if (!answerKeysPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }

  const documents = await listPublicAnswerKeys();

  return (
    <>
      <PublicAccessGuard flag="answerKeysPublic" />
      <PageHero
        title={
          <>
            Answer <span className="text-gradient">Keys</span>
          </>
        }
      />
      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal>
            <Suspense>
              <PortalAnswerKeysDrive
                programIds={programs.map((program) => program.id)}
                documents={documents}
                basePath="/answer-keys"
              />
            </Suspense>
          </Reveal>
        </div>
      </section>
    </>
  );
}
