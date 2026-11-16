import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Marketing shell. Signed-in portal redirects are handled in `proxy.ts`
 * so this layout stays static and the landing HTML can paint immediately.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader session={null} />
      <main className="bg-white">{children}</main>
      <SiteFooter />
    </>
  );
}
