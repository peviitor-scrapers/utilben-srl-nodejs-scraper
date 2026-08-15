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
- **Scraping Method:** eJobs.ro HTML (cheerio) + Mingle Careers API + ANOFM API
- **Default Location:** Cluj-Napoca

## Important Rules

### 1. Temporary Files
All temporary/scratch files MUST go in `tmp/` inside the project root.
NEVER use paths outside the project (e.g. `C:\Users\...\AppData\Local\Temp\opencode`).

### 2. Issues & GitHub
- **Orice modificare de cod trebuie să aibă un issue în GitHub Issues**
- Excepții: typo-uri, whitespace, documentație minoră
- Create a GitHub issue before implementing any change
- Commit messages must reference the issue they close
- Never commit credentials (`.env.local`, `*.pem`, etc.)
- Push after commit

### 3. Environment Variables
- All operations go through the Peviitor API (no direct SOLR access)
- Consistency tests need `GITHUB_REPOSITORY` (format: `owner/repo`) and `GITHUB_TOKEN`

### 4. Testing
```bash
npm run test:unit
npm run test:integration   # needs ANAF
npm run test:e2e           # needs ANAF
npm run test:consistency   # needs GITHUB_REPOSITORY + GITHUB_TOKEN
```

### 5. Commit & Push
- `git add -A && git commit -m "..." && git push`
- Commit messages must reference the related issue
- Never `--force` push

### Common pitfalls
- CIF `18643343` is 8 digits — valid for `/^\d{6,9}$/`
- ANOFM endpoint: `POST https://mediere.anofm.ro/api/entity/vw_public_job_posting`
- eJobs scraping uses User-Agent: Mozilla/5.0 browser header
