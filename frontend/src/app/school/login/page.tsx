import { redirect } from "next/navigation";
import { portalLoginHref } from "@/constants/auth";

/** Legacy URL — portal sign-in is the header dropdown on the home page. */
export default async function PortalLoginRedirect({
  searchParams,
}: PageProps<"/school/login">) {
  const { error } = await searchParams;
  redirect(portalLoginHref(typeof error === "string" ? error : null));
}
