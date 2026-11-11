import { completeGoogleSignIn } from "@/features/auth/google-complete";

export const dynamic = "force-dynamic";

export async function GET() {
  await completeGoogleSignIn();
}
