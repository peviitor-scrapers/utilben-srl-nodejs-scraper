# Instructions

## Project Purpose

This scraper extracts job listings from eJobs.ro and ANOFM for UTILBEN SRL and imports them to peviitor.ro.

## Model Schemas

The job and company models are defined in:
- `ai/job-model.md` - Job model schema
- `ai/company-model.md` - Company model schema

## Important

These models are **dynamic** and can change over time. They are based on the official Peviitor Core schemas which may be updated.

## How to Keep Models Updated

When working on this scraper:

1. **Check for updates** in the Peviitor Core repository:
   - Repository: https://github.com/peviitor-ro/peviitor_core
   - Main file: README.md (contains Job and Company model schemas)

2. **When to update**:
   - Before starting new development work
   - If field requirements or validations have changed
   - If new fields have been added

3. **How to update**:
   - Fetch the latest README.md from peviitor_core main branch
   - Compare with current ai/job-model.md and ai/company-model.md
   - Update local files if there are differences
   - Update scraper mapping logic if field requirements changed

## Technologies

- **Node.js & JavaScript** - For scraping and data extraction
- **Peviitor API** - For data storage and indexing (no direct SOLR access)
- **ANAF + CUIScan** - For company validation (multi-source fallback)

## Workflow Steps

1. **Get existing jobs from API** - Query Peviitor API by CIF to see what jobs already exist
2. **Validate company via ANAF** - Check company exists and is active (ANAF → CUIScan fallback)
3. **Scrape new jobs** - Extract jobs from eJobs.ro (cheerio HTML parsing)
4. **Scrape ANOFM** - Fetch additional jobs from ANOFM by CIF
5. **Transform for API** - Validate and fix job data:
   - location: Only Romanian cities allowed
   - tags: lowercase
   - company: uppercase
6. **Upsert to API** - Import/update jobs via Peviitor API
7. **Delete stale URLs** - Remove jobs that no longer appear in the scrape

## Running the Scraper

```bash
# Run the full scraper workflow
npm run scrape

# Test mode (eJobs only, no ANOFM)
npm run scrape -- --test

# Run via node directly
node scraper/index.js
```

No environment variables needed — all API access uses public Peviitor API (no SOLR_AUTH).

## Full Workflow (automatic)

When running `npm run scrape`, the following steps happen automatically:

1. **Query API by CIF** — get existing job URLs
2. **Validate company via ANAF** — with CUIScan fallback
3. **Scrape eJobs.ro** — parse HTML with cheerio
4. **Scrape ANOFM** — fetch jobs by CIF
5. **Transform for API** — normalize locations, workmode, tags
6. **Upsert to API** — via Peviitor API
7. **Delete stale URLs** — remove jobs no longer listed
8. **Generate docs/jobs.md** — markdown report + docs/company.json

## Workflow Flowchart

```
scraper/config/company.json (single source of truth: CIF, brand, URLs)
    │
    ▼
scraper/index.js
    │
    ├── querySOLR(CIF) — get existing jobs from API
    │
    ├── scraper/company.js (validate company)
    │   ├── load cache (company.json → tmp/company.json)
    │   │   └── if fresh (<7 days), skip ANAF entirely
    │   ├── ANAF API → CUIScan fallback ──► get company name + CIF
    │   ├── Peviitor API ──► validate company model
    │   └── API ──► check existing jobs count
    │
    ├── scrape eJobs.ro (cheerio HTML parsing)
    ├── scrape ANOFM (API by CIF)
    │
    ├── transformJobsForSOLR()
    │   ├── Filter: keep only Romanian locations
    │   ├── Fallback: "România" for unknown
    │   └── Format: lowercase tags, uppercase company
    │
    ├── upsertJobs() — via Peviitor API
    ├── delete stale URLs — via Peviitor API
    │
    └── generateJobsMarkdown() → docs/jobs.md
        └── committed to repo by CI → available on GitHub Pages
```

## File Responsibilities

| File | Role |
|------|------|
| `scraper/config/company.json` | **Single source of truth** for company identity (CIF, brand, URLs) |
| `scraper/config/company.js` | ESM wrapper that loads `scraper/config/company.json` for Node code |
| `scraper/index.js` | Main entry point — full workflow: scrape → transform → upsert → generate docs |
| `scraper/company.js` | Validates company via ANAF + Peviitor; caches in root `company.json` (7-day TTL) |
| `scraper/api.js` | Peviitor API operations — query, delete, upsert jobs. All SOLR access goes through the Peviitor API |
| `scraper/company-data.js` | Company data module — ANAF (demoanaf.ro) → CUIScan (cuiscan.ro) fallback; search → CUIFirma fallback |
| `scraper/company-data-cli.js` | CLI entry point for ANAF module (thin wrapper around scraper/company-data.js) |
| `scraper/validate-jobs.js` | Manual deep validator (content-aware); thin CLI wrapper over scraper/job-validator.js |
| `scraper/job-validator.js` | Shared validation primitives: validateByHead, validateByContent, DEFAULT_EXPIRED_KEYWORDS |
| `scraper/markdown-generator.js` | Generates docs/jobs.md with company info and all scraped jobs |
| `tests/validate-utilben-jobs.js` | CI fast validator (HEAD only); thin CLI over scraper/job-validator.js + scraper/api.js |
| `tests/unit/index.test.js` | Unit tests for transformJobsForSOLR, mapToJobModel, parseApiJobs |
| `tests/unit/company.test.js` | Unit tests for getCompanyData, validateAndGetCompany, fallback caching |
| `tests/unit/solr.test.js` | Unit tests for api.js Peviitor API operations |
| `tests/unit/company-data.test.js` | Unit tests for ANAF/CUIScan multi-source fallback |
| `tests/unit/job-validator.test.js` | Unit tests for job-validator.js |
| `tests/unit/markdown-generator.test.js` | Unit tests for markdown-generator.js |
| `tests/integration/workflow.test.js` | Live integration tests — ANAF + Peviitor API |
| `tests/e2e/scraper.test.js` | End-to-end tests with real eJobs, ANOFM, ANAF |
| `tests/consistency/public.test.js` | Verifies repo is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies branch, Pages, config, workflow files |
| `tests/consistency/topics.test.js` | Verifies required repo topics |
| `tests/consistency/workflow-naming.test.js` | Validates workflow naming conventions |

## API Endpoints

- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND` - Search companies by name/brand
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui` - Get company details by CIF
- **CUIScan**: `https://cuiscan.ro/api.php?action=company&cui=:cif` - Company data fallback
- **CUIFirma Search**: `https://cuifirma.ro/api/search?q=BRAND` - Company search fallback
- **Peviitor API**: `https://api.peviitor.ro/v1` - All SOLR operations (query, upsert, delete)

No direct SOLR access — all operations go through the Peviitor API. No SOLR_AUTH needed.

## Rate Limiting & Politeness

The scraper is intentionally slow to be a good citizen:

| Setting | Value | Where |
|---------|-------|-------|
| Request timeout | 10000 ms | scraper/index.js — TIMEOUT constant |
| Concurrency | 1 (sequential) | No Promise.all for paginated fetches |
| User-Agent | `job_seeker_ro_spider` | Identifies the scraper in server logs |

## Standalone Commands

```bash
# Run scraper
npm run scrape

# Test mode (eJobs only, no ANOFM)
npm run scrape -- --test

# Get company details from ANAF by CIF
node scraper/company-data-cli.js <CIF>

# Search companies in ANAF by brand
node scraper/company-data-cli.js search <brand>

# Validate job URLs from API by CIF (check active/expired)
node scraper/validate-jobs.js <CIF>

# Validate a single job URL
node scraper/validate-jobs.js --url <url>

# Delete expired jobs from API by CIF
node scraper/validate-jobs.js <CIF> --delete

# CI job validation (HEAD only)
node tests/validate-utilben-jobs.js <CIF> [--dry-run|--delete]
```

## Testing

This project requires multiple levels of testing:

1. **Unit Tests** - Test individual modules (api.js, company.js) in isolation
2. **Integration Tests** - Test API interactions (ANAF, Peviitor)
3. **E2E Tests** - Test full workflow with real data sources

Run tests:
```bash
npm test
```

## Temporary Files

All temporary/scratch files must be placed in `tmp/` inside the project root (never outside the project). The `tmp/` directory is in `.gitignore` and will not be committed.

## Technical Debt / Completed

- [x] Migrate from direct SOLR to Peviitor API
- [x] Add CUIScan/CUIFirma multi-source fallback for ANAF
- [x] Restructure to scraper/ subdirectory layout
- [x] Tests for all modules
