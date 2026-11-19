# Deployment — Cloudflare Pages

The site is static. There is no build command, no framework and no server-side code.

## Cloudflare Pages settings

| Setting | Value |
| --- | --- |
| Git provider | GitHub |
| Repository | `tanvirahmed-tamim/uk-vat-calculator` |
| Production branch | `main` |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `/` |
| Root directory | `/` |
| Environment variables | none |

Every push to `main` publishes the repository root. Pull requests get preview URLs.

## Files Cloudflare reads automatically

- `_redirects` — two rules: `/guides/vat-rates-explained.html` 301s to
  `/guides/vat-rates.html`, and `/guides/vat-for-overseas-clients.html` 301s to
  `/guides/vat-for-professional-services.html`.
- `_headers` — security headers and a short cache lifetime for HTML. Keep the CSP in step with
  the assets; if a new third-party script is ever added, the CSP must be updated deliberately.
- `404.html` — served automatically for unknown paths. It carries `noindex,follow`.

## Domain and DNS

The canonical host is the apex domain, `https://vatinuk.co.uk`. Every canonical, Open Graph,
Twitter, JSON-LD, `robots.txt` and `sitemap.xml` reference already uses it; there is no
`example.com` placeholder left in the build.

- Add `vatinuk.co.uk` as the custom domain in Cloudflare Pages.
- Add `www.vatinuk.co.uk` as a second custom domain, then create a 301 redirect from
  `www.vatinuk.co.uk/*` to `https://vatinuk.co.uk/$1` with a Cloudflare Redirect Rule or Bulk
  Redirect. Do not let both hosts serve the site.
- Set SSL/TLS mode to **Full (strict)** and enable **Always Use HTTPS**.
- Add HSTS only after the www redirect and HTTPS have been confirmed in production.

## Before the first production publish

1. Push the repository to GitHub and connect Cloudflare Pages with the settings above.
2. Add the apex domain and the `www` host, and configure the www-to-apex 301.
3. Confirm `https://vatinuk.co.uk/` serves the homepage over HTTPS with no redirect loop.
4. Confirm `https://www.vatinuk.co.uk/` returns a 301 to the apex.
5. Check `/guides/vat-rates-explained.html` returns a 301 to `/guides/vat-rates.html`.
6. Confirm `/sitemap.xml` contains 60 URLs and every `<loc>` uses `https://vatinuk.co.uk`.

## Post-launch checks

- Google Search Console: add the domain property, submit `/sitemap.xml`, check the homepage and
  three guide pages for coverage errors.
- Bing Webmaster Tools: import from Search Console or add the sitemap manually.
- Rich results: test the homepage, one guide and one calculator with the Schema Markup Validator.
- Page experience: test the homepage and the bulk calculator on a throttled mobile connection.
- Accessibility: keyboard through the calculator, the guides filter and the FAQ accordion; check
  focus visibility and 200% zoom.
- Security headers: confirm `_headers` is applied (for example with `curl -I`).
- Confirm no cookies are set and no third-party requests appear in the network panel.

## When advertising or analytics is added

This is a release, not a toggle:

1. Add the consent banner/CMP before any ad or analytics script loads.
2. Update the CSP in `_headers` for the new origins.
3. Rewrite `privacy-policy.html` and `cookies-policy.html`; remove the "no cookies" claim and the
   "last verified" date until the new state is true.
4. Update the independence and funding section of `editorial-policy.html`.
5. Label affiliate links and keep them out of the editorial body where they would change the
   answer.
6. Re-test consent rejection: no non-essential cookies or requests before consent.

## Rollback

Cloudflare Pages keeps every deployment. Use **Deployments → (previous) → Rollback** to restore
the last good build. Because the repository is the source of truth, also revert the commit that
introduced the problem so the next deploy does not reintroduce it.
