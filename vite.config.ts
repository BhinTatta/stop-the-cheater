import { defineConfig, type Plugin } from "vite";

/**
 * Link previews need absolute URLs, but the deployed origin isn't known until
 * build time. Vercel and Netlify both expose it, so read it from there and
 * fall back to SITE_URL for anything else. With none of them set the tags fall
 * back to root-relative paths, which most scrapers resolve against the page.
 */
function resolveSiteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const raw = process.env.SITE_URL || process.env.URL || (vercel ? `https://${vercel}` : "");
  if (!raw) return "";
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

/** Replaces %SITE_URL% in index.html with the deployed origin (or ""). */
function siteUrlPlugin(): Plugin {
  const siteUrl = resolveSiteUrl();
  return {
    name: "stop-the-cheater-site-url",
    transformIndexHtml(html) {
      return html.replaceAll("%SITE_URL%", siteUrl);
    },
  };
}

export default defineConfig({
  plugins: [siteUrlPlugin()],
  test: {
    environment: "node",
  },
});
