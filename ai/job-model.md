# Job Model Schema

## Fields

| Field          | Type     | Required | Description and rules |
|----------------|----------|----------|----------------------|
| url            | string   | Yes      | Full URL to the job detail page. unique. **url** must be valid HTTP/HTTPS URL, canonical job detail page |
| title          | string   | Yes      | Exact position title. **title** max 200 chars, no HTML, trimmed whitespace, **DIACRITICS ACCEPTED** (ăâîșțĂÂÎȘȚ) |
| company        | string   | No       | Name of the hiring company. Real name. Full name. Use uppercase always. not just a brand or a code. Legal name. **company** must match exactly Company.name (case insensitive, **DIACRITICS ACCEPTED**) |
| cif            | string   | No       | CIF/CUI. Due to the fact that Systematic SRL exist with same name in 3 different counties Bihor, Arad, Timis |
| location       | string[] | No       | Location or detailed address. **location** Romanian cities/addresses, **DIACRITICS ACCEPTED** (ex: "București", "Cluj-Napoca"). multi-valued, stored as array |
| tags           | string[] | No       | Tag-uri skills/educație/experiență. **tags** lowercase, max 20 entries, standardized values only, **NO DIACRITICS** |
| workmode       | string   | No       | "remote", "on-site", "hybrid". **workmode** only: "remote", "on-site", "hybrid" |
| date           | date     | No       | Data scrape/indexare (ISO8601). **date** = UTC ISO8601 timestamp of scrape (ex: "2026-01-18T10:00:00Z") |
| status         | string   | No       | "scraped", "tested", "published", "verified". **status** starts "scraped", progresses: scraped → tested → published → verified |
| vdate          | date     | No       | Verified date (ISO8601). **vdate** set only when validation="verified" |
| expirationdate | date     | No       | Data expirare estimată job. **expirationdate** = vdate + 30 days max, or extract from job page |
| salary         | string   | No       | Interval salarial + currency (ex: "5000-8000 RON", "4000 EUR"). **salary** format: "MIN-MAX CURRENCY" ; must be a string not an array |

## Job Status Flow

Job status follows this progression: `scraped` → (`tested` OR `verified`) → `published`

| Status     | Meaning                              | When to Use |
|------------|--------------------------------------|-------------|
| scraped    | Newly scraped, not validated yet     | Default after scraping |
| tested     | URL works, job exists but couldn't extract full details | Page blocked by CAPTCHA, didn't load properly, missing salary/tags/workmode |
| verified   | Fully scraped with all details       | All fields extracted: company, cif, salary, tags, workmode |
| published  | Imported from jobs core              | Old validator flow - jobs imported to main job index |

Notes:
- tested jobs can be re-validated later when more data becomes available
- vdate (verified date) is set only when status becomes tested or verified
- Jobs with status verified are considered valid and ready for publication

> **Note**: Fields marked as `string[]` are multi-valued arrays. In SOLR/OpenSearch these are stored as arrays (e.g., `["București", "Cluj-Napoca"]`).

## Scraper Rules

- tags must be lowercase with NO diacritics
- location accepts diacritics (București, Cluj-Napoca)
- title accepts diacritics
- company must be uppercase
- salary must be a string, not an array
