/**
 * Origem pública do app (ex: https://dashboard-production-c168.up.railway.app).
 *
 * Derivada de DISCORD_REDIRECT_URI em vez de request.url: atrás do proxy do
 * Railway, request.url pode refletir o host interno do container
 * (localhost:<PORT>) em vez do domínio público, o que quebrava os redirects
 * pós-login.
 */
export function getAppOrigin(): string {
  return new URL(process.env.DISCORD_REDIRECT_URI!).origin;
}
