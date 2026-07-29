# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile UTILBEN SRL din România.

Extrage anunțurile de pe [eJobs.ro](https://www.ejobs.ro/company/utilben/123016) și [ANOFM](https://www.anofm.ro) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul Peviitor.

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) după CIF-ul UTILBEN (18643343) și verifică:
   - Denumirea oficială: UTILBEN SRL
   - Status: activ/inactiv/radiat
   - Adresa completă din registrul comerțului
2. **Cross-validează cu Peviitor** — verifică existența companiei în API-ul Peviitor
3. **Scrape-uiește job-urile** — extrage lista de job-uri de pe eJobs.ro (pagina companiei) și de pe ANOFM
4. **Transformă datele** — normalizează locațiile (doar orașe românești), tag-urile (lowercase), workmode-ul (remote/on-site/hybrid)
5. **Stochează în Peviitor** — upsert prin API-ul Peviitor (job-uri și date companie)
6. **Generează jobs.md** — fișier markdown cu informații companie + toate job-urile curente

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| eJobs.ro | `https://www.ejobs.ro/company/utilben/123016` | Public |
| ANOFM | `https://mediere.anofm.ro/api/entity/vw_public_job_posting` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| Peviitor | `https://api.peviitor.ro/v1/` | Public |

## Testare

```bash
# Toate testele
npm test

# Doar unitare
npm run test:unit

# Doar integrare (necesită ANAF live, Peviitor API conditional)
npm run test:integration

# Doar E2E (API real eJobs + ANAF + Peviitor)
npm run test:e2e
```
