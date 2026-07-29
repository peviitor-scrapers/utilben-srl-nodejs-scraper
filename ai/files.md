# Project Files

## JavaScript Files — scraper/

| File | Description |
|------|-------------|
| `scraper/index.js` | Main scraper - full workflow: scrape eJobs + ANOFM → transform → upsert → generate docs/jobs.md |
| `scraper/company.js` | Validates company via ANAF + Peviitor APIs, checks if company is active/inactive |
| `scraper/api.js` | Peviitor API operations module — all SOLR access goes through the Peviitor API (no direct SOLR calls) |
| `scraper/company-data.js` | Company data module — ANAF (demoanaf.ro) → CUIScan (cuiscan.ro) fallback for company data; ANAF search → CUIFirma fallback for search |
| `scraper/company-data-cli.js` | CLI entry point for company data module (thin wrapper around scraper/company-data.js) |
| `scraper/validate-jobs.js` | **Generic deep validator (manual use).** Full GET requests, parses page body for "no longer available" keywords. Works with any CIF, single URL, or file. Slower but catches soft-404s. Not used by CI. |
| `scraper/job-validator.js` | Shared validation primitives — exports validateByHead(url), validateByContent(url, opts), DEFAULT_EXPIRED_KEYWORDS. Used by both `scraper/validate-jobs.js` and `tests/validate-utilben-jobs.js`. |
| `scraper/markdown-generator.js` | Generates docs/jobs.md — exports generateJobsMarkdown(companyData, jobs) |

## Config — scraper/config/

| File | Description |
|------|-------------|
| `scraper/config/company.json` | **Single source of truth for company identity.** All scraper code, CI workflows, and the static HTML read from this file. To derive a scraper for a different company, this is the primary file to edit. |
| `scraper/config/company.js` | ESM wrapper that imports and exposes `scraper/config/company.json` to Node code |

## Test Files — tests/

| File | Description |
|------|-------------|
| `tests/package.json` | Jest config for test suite - experimental VM modules, test scripts (unit/integration/e2e/consistency) |
| `tests/company.json` | Mock ANAF company data for UTILBEN used in unit tests |
| `tests/validate-utilben-jobs.js` | **UTILBEN-specific fast validator (used by CI).** HEAD requests only. Called nightly by `automation-testing.yml`. Supports `--dry-run` and `--delete`. |
| `tests/unit/index.test.js` | Unit tests for index.js — transformJobsForSOLR, mapToJobModel |
| `tests/unit/company.test.js` | Unit tests for company.js — getCompanyData, validateAndGetCompany, fallback caching |
| `tests/unit/api.test.js` | Unit tests for api.js — querySOLR, upsertJobs, deleteJobByUrl, deleteJobsByCIF |
| `tests/unit/company-data.test.js` | Unit tests for company-data.js — ANAF + CUIScan fallback, search + CUIFirma fallback |
| `tests/unit/job-validator.test.js` | Unit tests for job-validator.js — validateByHead, validateByContent |
| `tests/unit/markdown-generator.test.js` | Unit tests for markdown-generator.js — company section, jobs section, output format |
| `tests/integration/workflow.test.js` | Integration tests — ANAF live API, Peviitor API |
| `tests/e2e/scraper.test.js` | E2E tests — full pipeline with real eJobs HTML, ANOFM API, ANAF |
| `tests/consistency/public.test.js` | Verifies repository is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies default branch, GitHub Pages, company.json config, workflow files |
| `tests/consistency/topics.test.js` | Verifies repository has required topics: job-seeker-ro-spider, peviitor-ro |
| `tests/consistency/workflow-naming.test.js` | Validates workflow file naming conventions |

## Markdown Files

| File | Description |
|------|-------------|
| `ai/INSTRUCTIONS.md` | Project documentation — workflow, technologies, API endpoints |
| `ai/job-model.md` | Job schema definition (Peviitor Core) — fields, types, validation rules |
| `ai/company-model.md` | Company schema definition (Peviitor Core) — fields, types, validation rules |
| `ai/files.md` | This file — documents role of each project file |
| `ai/AGENTS.md` | Rules for AI agents working on this project |
| `ai/BRANCH.md` | Branch strategy and naming conventions |
| `ai/CHANGELOG.md` | Version history and notable changes |
| `ai/CONTRIBUTING.md` | Contribution guidelines |
| `ai/ISSUES.md` | Issue tracking conventions |
| `ai/PUBLIC.md` | Notes on public visibility and data policies |
| `ai/ROBOTS.md` | robots.txt analysis and scraping policy |
| `ai/TOPICS.md` | Repository topics documentation |
| `ai/UPDATE-REPO-ABOUT.md` | Instructions for updating repo description/about |
| `ai/VERIFY.md` | Step-by-step verification checklist after changes |

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js project config - dependencies (node-fetch, cheerio), scripts |
| `package-lock.json` | Locked dependency versions |
| `.npmrc` | npm configuration |
| `.gitignore` | Ignores node_modules/, tmp/ |
| `.github/CODEOWNERS` | Code ownership rules for PR reviews |
| `.github/workflows/job-seeker-ro-spider.yml` | Daily scraping workflow (6 AM UTC) |
| `.github/workflows/automation-testing.yml` | Automated tests on every push/PR |

## Data Files

| File | Description |
|------|-------------|
| `company.json` | **ANAF cache (committed).** Survives between CI runs so the scraper does not hit demoANAF on every scrape. Refreshed when older than 7 days (configurable via `CACHE_MAX_AGE_DAYS` in company.js). |
| `docs/company.json` | Static copy of `scraper/config/company.json` regenerated on each scrape. Served by GitHub Pages so the live page can read company identity without hardcoding it in HTML. |
| `docs/jobs.md` | Scraped jobs in markdown format — company info + all current jobs (generated by CI after each scrape) |

## Notes

- All `.md` schema files (ai/job-model.md, ai/company-model.md) are dynamic — check peviitor_core README.md for updates
- `tmp/` directory holds runtime artifacts (jobs.json, jobs_existing.json) — not committed
- All SOLR access goes through the Peviitor API (`api.peviitor.ro/v1`) — no direct SOLR calls, no SOLR_AUTH needed
- Full workflow: scrape eJobs + ANOFM → transform → upsert via Peviitor API → generate docs/jobs.md
