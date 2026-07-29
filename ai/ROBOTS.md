# Robots.txt Analysis

Scraping sources used by this scraper:

## eJobs.ro
- Source: https://www.ejobs.ro/robots.txt
- Scope: Company profile page at /company/utilben/
- Behavior: Single page fetch, no automated job applications or search queries
- User-Agent: `job_seeker_ro_spider` (identifiable)

## ANOFM (Agentia Nationala pentru Ocuparea Fortei de Munca)
- API: https://mediere.anofm.ro/api/entity/vw_public_job_posting
- Public API endpoint, filtered by CIF
- User-Agent: `job_seeker_ro_spider`

## Policy
- 1 request per scrape session
- Respectful rate limiting
- No concurrent requests
- Only fetches publicly listed job data
