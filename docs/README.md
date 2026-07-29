# job_seeker_ro_spider — UTILBEN SRL Scraper

**job_seeker_ro_spider** — scraper pentru job-urile UTILBEN SRL din România.

Extrage anunțurile de pe [eJobs.ro](https://www.ejobs.ro/company/utilben/123016) și [ANOFM](https://www.anofm.ro) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul Peviitor.

## Cum funcționează

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) după CIF-ul UTILBEN (18643343) și verifică:
   - Denumirea oficială: UTILBEN SRL
   - Status activ
2. **Scrape-uiește job-urile** — extrage lista de job-uri de pe eJobs.ro (pagina companiei) și de pe ANOFM
3. **Salvează în Peviitor** — upsert în baza de date prin API-ul Peviitor
4. **Raportează** — generează docs/jobs.md și actualizează pagina live

## Surse de date

| Sursă | URL | Tip |
|-------|-----|-----|
| eJobs.ro | `https://www.ejobs.ro/company/utilben/123016` | HTML (cheerio) |
| ANOFM | `https://mediere.anofm.ro/api/entity/vw_public_job_posting` | API JSON |
| ANAF | `https://demoanaf.ro/api/company/18643343` | API JSON (validare) |

## eJobs.ro

Se extrage pagina de profil a companiei și se parsează card-urile de job-uri cu cheerio.

## ANOFM

API-ul public ANOFM se interoghează cu CIF-ul companiei pentru a găsi job-uri asociate.

## Robots.txt

Acest scraper respectă robots.txt al surselor. Vezi [ROBOTS.md](../ai/ROBOTS.md).

## Run

```bash
# Normal run (full scrape)
npm run scrape

# Test mode (single page, no ANOFM)
npm run scrape -- --test
```

## Teste

```bash
npm test                 # all tests
npm run test:unit        # unit tests
npm run test:integration # integration tests
npm run test:e2e         # end-to-end tests
npm run test:consistency # consistency checks
```
