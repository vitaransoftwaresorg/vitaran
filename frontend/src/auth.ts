import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js is only the Google handshake.
 * Portal sessions stay the existing school / teacher JWT cookies.
 *
 * Authorization / token / userinfo URLs are set explicitly so sign-in does not
 * depend on Google's OIDC discovery fetch, which fails as `Configuration`
 * in some local Node/Next environments.
 */
const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers:
    googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            authorization: {
              url: "https://accounts.google.com/o/oauth2/v2/auth",
              params: {
                prompt: "select_account",
                response_type: "code",
                scope: "openid email profile",
              },
            },
            token: "https://oauth2.googleapis.com/token",
            userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
          }),
        ]
      : [],
  session: { strategy: "jwt", maxAge: 60 * 5 },
  pages: {
    signIn: "/school/login",
    error: "/auth/google/error",
  },
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === "google" && account.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    session({ session, token }) {
      session.idToken = typeof token.idToken === "string" ? token.idToken : undefined;
      return session;
    },
  },
});
