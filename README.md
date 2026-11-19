# VAT in UK

VAT in UK is a static UK VAT calculator and reference site at `https://vatinuk.co.uk`. Add or
remove VAT at 20%, 5%, 0% or a custom rate, check the £90,000 registration threshold, process a
list of invoice lines, estimate the Flat Rate Scheme, and read sourced guides on UK VAT.

The site is plain HTML, one compiled CSS file and vanilla JavaScript. Every calculation runs in
the browser: there is no server, no account, no database of user figures, no analytics and no
cookies.

## What is in the repository

```
/                         root pages (home, about, contact, FAQs, glossary, legal, trust)
/guides/                  41 UK VAT guides
/calculators/             7 standalone calculators
/assets/                  compiled CSS, shared JS, rate data, images
/sitemap.xml              generated sitemap (loc + lastmod only)
/robots.txt               allows everything, points to the sitemap
/_redirects               Cloudflare Pages redirects for retired URLs
/_headers                 security and cache headers for Cloudflare Pages
/404.html                 not-found page with noindex
```

## Calculators

| URL | Purpose |
| --- | --- |
| `/` | Main add/remove VAT calculator |
| `/calculators/vat-fraction.html` | Extract VAT from a gross amount |
| `/calculators/margin-scheme.html` | VAT on the margin for second-hand goods |
| `/calculators/reverse-charge.html` | Domestic reverse charge deemed VAT |
| `/calculators/vat-on-expenses.html` | Reclaimable input tax on an expense |
| `/calculators/registration-threshold.html` | Rolling £90,000 turnover check |
| `/calculators/bulk-vat.html` | Up to 500 invoice lines at one rate, CSV copy |
| `/calculators/flat-rate-scheme.html` | HMRC sector rates, limited cost, first year |

## Local preview

No build step is required to view the published site. Any static server works:

```bash
npx serve .
# or
python -m http.server 8080
```

Opening `index.html` directly with `file://` also works because all paths are relative, but a
local server gives more realistic behaviour for redirects and headers.

## Content standards

- Scope is UK VAT only. Income tax, corporation tax, payroll and customs duty are out of scope
  except where a reader needs to know that they are separate from VAT.
- Figures come from GOV.UK, HMRC VAT notices and manuals, and legislation.gov.uk. Secondary
  sources are never the reason a figure is published.
- Every content page lists its sources at the bottom and repeats them as `citation` data in the
  page's JSON-LD.
- There is no named individual author or reviewer. Content is published under the
  "VAT in UK team" name. No page claims a review that did not happen.
- Corrections that change a figure or a rule are recorded in `/corrections.html`.
- The site sets no cookies and loads no third-party scripts. If advertising, affiliate links or
  analytics are added, the privacy and cookies policies and the consent approach must change in
  the same release.

See `/editorial-policy.html` and `/methodology.html` for the full statements.

## Deployment

The site is designed for Cloudflare Pages with no build command and the repository root as the
output directory. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the exact settings, the domain
checklist and the post-launch checks.

## Licence

The source code (HTML structure, CSS and JavaScript) is released under the MIT licence in
[`LICENSE`](LICENSE). The editorial content, data files and branding are © VAT in UK and
are not covered by the MIT licence. See the licence file for the split.

## Disclaimer

This is general information, not tax advice. VAT treatment depends on the facts of a supply and
the rules in force at its tax point. Confirm with GOV.UK or a qualified adviser before filing.
