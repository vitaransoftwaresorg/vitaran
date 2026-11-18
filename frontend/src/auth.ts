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
  // Required behind Nginx on the VPS so callback URLs use the public https host.
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
    // Thin redirect → /?login=1 (header dropdown). Auth.js needs a path, not a query-only URL.
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
    // Keep users on this app after Google — never fall back to a baked-in localhost AUTH_URL.
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        // ignore invalid url
      }
      return baseUrl;
    },
  },
});
