# Company Model Schema

## Fields

| Field       | Type     | Required | Description |
|-------------|----------|----------|-------------|
| id          | string   | Yes      | CIF/CUI of the company (e.g. "12345678"). **id** = exact CIF/CUI 8 digits (no RO prefix) |
| company     | string   | Yes      | Exact name for job matching. **company** = legal name from Trade Register, **DIACRITICS REQUIRED** (e.g. "Tehnologia Informației"). Use uppercase |
| brand       | string   | No       | Commercial brand name (e.g. "ORANGE", "EPAM"). Used for display purposes |
| group       | string   | No       | Parent company group (e.g. "Orange Group", "EPAM Systems") |
| status      | string   | No       | Status: "activ", "suspendat", "inactiv", "radiat". If company status is not active, remove jobs; also remove company. **status** only: "activ", "suspendat", "inactiv", "radiat" |
| location    | string[] | No       | Location or detailed address. **location** Romanian cities/addresses, **DIACRITICS ACCEPTED** (e.g. "București", "Cluj-Napoca"). multi-valued, stored as array |
| website     | string[] | No       | Official company website. **website** must be a valid HTTP/HTTPS URL, preferably canonical, without trailing slash (e.g. "https://www.example.ro"). multi-valued, stored as array |
| career      | string[] | No       | Official company career page. **career** must be a valid HTTP/HTTPS URL, preferably canonical, without trailing slash, pointing to the jobs/careers section (e.g. "https://www.example.ro/careers"). multi-valued, stored as array |
| lastScraped | string   | No       | Date of last scrape in ISO8601 format (e.g. "2026-02-20"). Used for tracking |
| scraperFile | string   | No       | Name of the scraper file used (e.g. "epam.md", "orange.md"). Used for reference |

> **Note**: Fields marked as `string[]` are multi-valued arrays. In SOLR/OpenSearch these are stored as arrays (e.g., `["https://example.com", "https://careers.example.com"]`).
