# AGENTS.md — Rules for AI agents

## Project
UTILBEN SRL scraper for peviitor.ro (Node.js, ESM, Jest)

## 🌱 This Repo Is a Derived Scraper
This repo was derived from [sebiboga/epam-systems-international-srl-nodejs-scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper). All company-specific configuration lives in `scraper/config/company.json`.

## Key Facts
- **Company:** UTILBEN SRL
- **CIF:** 18643343
- **Brand:** Utilben
- **Website:** https://www.utilben.ro
- **Career URL:** https://www.utilben.ro/careers
- **Scraping Method:** eJobs.ro HTML (cheerio) + ANOFM API
- **Default Location:** Cluj-Napoca

## Important Rules

### Before making changes
1. Read `scraper/config/company.json` first
2. Check if the change affects company schema (cif format: `/^\d{6,9}$/`)
3. Run `npm test` after changes

### Common pitfalls
- CIF `18643343` is 8 digits — valid for `/^\d{6,9}$/`
- ANOFM endpoint: `POST https://mediere.anofm.ro/api/entity/vw_public_job_posting`
- eJobs scraping uses User-Agent: Mozilla/5.0 browser header
