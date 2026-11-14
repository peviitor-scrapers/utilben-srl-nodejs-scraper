import fetch from "node-fetch";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, upsertJobs, upsertCompany, deleteJobByUrl } from "./api.js";
import { generateJobsMarkdown } from "./markdown-generator.js";
import companyConfig from "./config/company.js";
import scraperConfig from "./config/scraper.js";
import * as cheerio from "cheerio";

const COMPANY_CIF = companyConfig.id;
const CAREER_URL = `${scraperConfig.apiBase}${scraperConfig.apiListPath}`;
const TIMEOUT = 10000;

let COMPANY_NAME = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const execFileAsync = promisify(execFile);

const EJOBS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7"
};

const CLOUDFLARE_BLOCK_RE = /Sorry, you have been blocked|cf-error-details|Just a moment\.\.\./i;

function isCloudflareBlock(status, html) {
  return status === 403 || CLOUDFLARE_BLOCK_RE.test(html || "");
}

async function fetchEJobsHtml(url) {
  try {
    const res = await fetch(url, { timeout: TIMEOUT, headers: EJOBS_HEADERS });
    const html = await res.text();
    if (res.ok && !isCloudflareBlock(res.status, html)) {
      return { ok: true, status: res.status, html, transport: "fetch" };
    }
    const reason = isCloudflareBlock(res.status, html) ? " (Cloudflare block)" : "";
    console.log(`  eJobs fetch returned ${res.status}${reason} — retrying with curl`);
  } catch (err) {
    console.log(`  eJobs fetch error: ${err.message} — retrying with curl`);
  }

  try {
    const { stdout } = await execFileAsync("curl", [
      "-sS", "-L", "--max-time", String(Math.ceil(TIMEOUT / 1000)),
      "-A", EJOBS_HEADERS["User-Agent"],
      "-H", `Accept: ${EJOBS_HEADERS["Accept"]}`,
      "-H", `Accept-Language: ${EJOBS_HEADERS["Accept-Language"]}`,
      url
    ], { maxBuffer: 20 * 1024 * 1024 });

    if (stdout && !isCloudflareBlock(0, stdout)) {
      console.log("  eJobs fetched via curl fallback");
      return { ok: true, status: 200, html: stdout, transport: "curl" };
    }

    const reason = isCloudflareBlock(0, stdout) ? "was blocked" : "returned an empty response";
    console.log(`  eJobs curl fallback ${reason}`);
    return { ok: false, status: isCloudflareBlock(0, stdout) ? 403 : 0, html: stdout || "", transport: "curl" };
  } catch (err) {
    console.log(`  eJobs curl fallback error: ${err.message}`);
    return { ok: false, status: 0, html: "", transport: "curl", error: err.message };
  }
}

async function fetchANOFMJobs(cif) {
  const jobs = [];
  try {
    console.log(`Searching ANOFM by CIF: ${cif}`);
    const payload = {
      current: 1,
      rowCount: 250,
      sort: { created_at: "desc" },
      employer_tax_code: cif
    };
    const res = await fetch("https://mediere.anofm.ro/api/entity/vw_public_job_posting", {
      method: "POST",
      timeout: TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "job_seeker_ro_spider"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.log(`  ANOFM returned ${res.status}`);
      return { jobs, ok: false };
    }
    const data = await res.json();
    for (const row of data.rows || []) {
      const locationParts = (row.address_locality_name || '').split('>').map(s => s.trim());
      const location = locationParts.length > 1 ? locationParts[locationParts.length - 1] : locationParts[0];
      jobs.push({
        url: `https://mediere.anofm.ro/app/module/mediere/job/${row.id}`,
        title: row.occupation,
        location: location ? [location] : undefined,
        source: "ANOFM"
      });
    }
    console.log(`  Found ${jobs.length} jobs on ANOFM`);
    return { jobs, ok: true };
  } catch (err) {
    console.log(`  ANOFM error: ${err.message}`);
    return { jobs, ok: false };
  }
}

async function fetchMingleJobs() {
  const jobs = [];
  try {
    const url = "https://mingle.ro/api/boards/careers-page/jobs?company=utilben&page=0&pageSize=30&sort=";
    console.log(`Fetching Mingle careers: ${url}`);
    const res = await fetch(url, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent": "job_seeker_ro_spider",
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      console.log(`  Mingle API returned ${res.status}`);
      return { jobs, ok: false };
    }
    const data = await res.json();
    for (const job of data.data?.results || []) {
      const locations = (job.locations || []).map(l => l.label).filter(Boolean);
      jobs.push({
        url: `https://utilben.mingle.ro/en/apply/${job.uid}`,
        title: job.title,
        location: locations.length > 0 ? locations : undefined,
        source: "Mingle"
      });
    }
    console.log(`  Found ${jobs.length} jobs on Mingle`);
    return { jobs, ok: true };
  } catch (err) {
    console.log(`  Mingle error: ${err.message}`);
    return { jobs, ok: false };
  }
}

export async function scrapeMingleCareers() {
  return (await fetchMingleJobs()).jobs;
}

export function parseEJobsHtml(html) {
  const jobs = [];
  const $ = cheerio.load(html);
  $(".job-card-wrapper").each((i, el) => {
    const linkEl = $(el).find(".job-card-content__logo");
    const jobUrl = linkEl.attr("href");
    const titleEl = $(el).find(".job-card-content-middle__title");
    const title = titleEl.text().trim();
    const infoEls = $(el).find(".job-card-content-middle__info, .job-card-content-middle__info a");
    const location = [];
    infoEls.each((j, infoEl) => {
      const text = $(infoEl).text().trim();
      if (text && !text.startsWith("http") && text !== "UTILBEN" && text !== "Aplică rapid" && !location.includes(text)) {
        location.push(text);
      }
    });
    if (title && jobUrl) {
      jobs.push({
        url: `https://www.ejobs.ro${jobUrl}`,
        title: title,
        location: location.length > 0 ? location : undefined,
        source: "eJobs"
      });
    }
  });
  return jobs;
}

async function fetchEJobsJobs() {
  console.log(`Fetching eJobs page: ${CAREER_URL}`);
  try {
    const result = await fetchEJobsHtml(CAREER_URL);
    if (!result.ok) {
      console.log(`  eJobs unavailable (status ${result.status})`);
      return { jobs: [], ok: false };
    }
    const jobs = parseEJobsHtml(result.html);
    console.log(`  Found ${jobs.length} jobs on eJobs via ${result.transport}`);
    return { jobs, ok: true };
  } catch (err) {
    console.log(`  eJobs error: ${err.message}`);
    return { jobs: [], ok: false };
  }
}

function mapToJobModel(rawJob, cif, companyName = COMPANY_NAME) {
  const now = new Date().toISOString();
  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: companyName,
    cif: cif,
    location: rawJob.location?.length ? rawJob.location : undefined,
    tags: rawJob.tags?.length ? rawJob.tags : undefined,
    workmode: rawJob.workmode || undefined,
    date: now,
    status: "scraped"
  };
  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);
  return job;
}

const ROMANIAN_LOCATION_NAMES = [
  'București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Brașov', 'Constanța',
  'Craiova', 'Bacău', 'Sibiu', 'Târgu Mureș', 'Oradea', 'Baia Mare',
  'Satu Mare', 'Ploiești', 'Pitești', 'Arad', 'Galați', 'Brăila',
  'Drobeta-Turnu Severin', 'Râmnicu Vâlcea', 'Buzău', 'Botoșani', 'Zalău',
  'Hunedoara', 'Deva', 'Suceava', 'Bistrița', 'Tulcea', 'Călărași',
  'Giurgiu', 'Alba Iulia', 'Slatina', 'Piatra Neamț', 'Roman', 'Dumbrăvița',
  'Voluntari', 'Popești-Leordeni', 'Chitila', 'Mogoșoaia', 'Otopeni',
  'Focșani', 'Târgoviște', 'Târgu Jiu', 'Miercurea Ciuc', 'Sfântu Gheorghe',
  'Reșița', 'Alexandria', 'Slobozia', 'Vaslui', 'Bârlad', 'Mediaș', 'Turda',
  'Câmpia Turzii', 'Petroșani', 'Lugoj', 'Pașcani', 'Sighetu Marmației',
  'Vatra Dornei', 'Beclean', 'Aleșd', 'Beiuș', 'Baciu', 'Florești',
  'Odorheiu Secuiesc', 'Sighișoara', 'Făgăraș', 'Codlea', 'Săcele', 'Râșnov',
  'Mioveni', 'Câmpulung', 'Curtea de Argeș', 'Târgu Frumos', 'Hârlău',
  'Dorohoi', 'Comănești', 'Onești', 'Adjud', 'Tecuci', 'Oltenița', 'Urziceni',
  'Fetești', 'Năvodari', 'Mangalia', 'Medgidia', 'Cernavodă', 'Eforie',
  'Sinaia', 'Câmpina', 'Băicoi', 'Breaza', 'Titu', 'Găești', 'Pucioasa',
  'Moreni', 'Rovinari', 'Motru', 'Târgu Cărbunești', 'Strehaia', 'Orșova',
  'Băile Herculane', 'Caransebeș', 'Jimbolia', 'Recaș', 'Deta',
  'Sânnicolau Mare', 'Toplița', 'Gheorgheni', 'Cristuru Secuiesc', 'Baraolt',
  'Covasna', 'Târgu Secuiesc', 'Negrești-Oaș', 'Carei',
  'Alba', 'Argeș', 'Bihor', 'Bistrița-Năsăud', 'Caraș-Severin', 'Cluj',
  'Dâmbovița', 'Dolj', 'Gorj', 'Harghita', 'Ialomița', 'Ilfov', 'Maramureș',
  'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Sălaj', 'Teleorman',
  'Timiș', 'Vâlcea', 'Vrancea'
];

const LOCATION_ALIASES = {
  bucharest: 'București',
  bucuresti: 'București',
  'targu mures': 'Târgu Mureș',
  'ramnicu valcea': 'Râmnicu Vâlcea',
  'piatra neamt': 'Piatra Neamț',
  'bistrita nasaud': 'Bistrița-Năsăud',
  'targoviste': 'Târgoviște',
  'campulung muscel': 'Câmpulung'
};

function normalizeLocationKey(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const LOCATION_LOOKUP = new Map();
for (const name of ROMANIAN_LOCATION_NAMES) {
  LOCATION_LOOKUP.set(normalizeLocationKey(name), name);
}
for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
  LOCATION_LOOKUP.set(normalizeLocationKey(alias), canonical);
}

export function splitLocationValues(locations) {
  const parts = [];
  for (const value of locations || []) {
    if (!value) continue;
    for (const part of String(value).split(/[,;]/)) {
      const trimmed = part.trim();
      if (trimmed) parts.push(trimmed);
    }
  }
  return parts;
}

export function canonicalLocation(value) {
  const cleaned = String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(și|si)\s+alte.*$/i, '')
    .trim();
  if (!cleaned) return null;

  const key = normalizeLocationKey(cleaned);
  if (!key) return null;
  if (key === 'romania') return 'România';
  return LOCATION_LOOKUP.get(key) || null;
}

function transformJobsForSOLR(payload) {
  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('office') || lower.includes('on-site') || lower.includes('site')) return 'on-site';
    return 'hybrid';
  };
  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      const validLocations = [];
      for (const part of splitLocationValues(job.location)) {
        const canonical = canonicalLocation(part);
        if (canonical && !validLocations.includes(canonical)) {
          validLocations.push(canonical);
        }
      }
      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ['România'],
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };
  return transformed;
}

export function sourceForUrl(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes("ejobs.ro")) return "eJobs";
  if (value.includes("mingle.ro")) return "Mingle";
  if (value.includes("anofm.ro")) return "ANOFM";
  return "unknown";
}

export function getStaleUrls(existingUrls, scrapedUrls, sourceHealth) {
  return [...existingUrls].filter(url => {
    if (scrapedUrls.has(url)) return false;
    const source = sourceForUrl(url);
    if (source === "unknown") return false;
    return sourceHealth[source] === true;
  });
}

async function main() {
  const testOnlyOnePage = process.argv.includes("--test");
  try {
    fs.mkdirSync("tmp", { recursive: true });

    console.log("=== Step 1: Get existing jobs from API ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    const existingUrls = new Set(existingResult.docs.map(doc => doc.url).filter(Boolean));
    console.log(`Found ${existingCount} existing jobs in API`);

    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif, address, status } = await validateAndGetCompany();
    COMPANY_NAME = company;
    if (status === 'inactive') {
      console.log("⚠️ Company is INACTIVE — jobs deleted, skipping scrape.");
      return;
    }

    try {
      await upsertCompany({
        id: cif,
        company,
        brand: companyConfig.brand || undefined,
        status: status === 'active' ? 'activ' : (status || "activ"),
        location: address ? [address] : companyConfig.location,
        website: companyConfig.website,
        career: companyConfig.career,
        scraperFile: companyConfig.scraperFile,
        lastScraped: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.log(`Note: Could not upsert company: ${err.message}`);
    }

    const rawJobs = [];
    const sourceHealth = { eJobs: false, Mingle: false, ANOFM: false };

    console.log("=== Step 3: Scrape jobs from eJobs ===");
    const eJobsResult = await fetchEJobsJobs();
    sourceHealth.eJobs = eJobsResult.ok;
    for (const job of eJobsResult.jobs) {
      if (!rawJobs.find(j => j.url === job.url)) {
        rawJobs.push(job);
      }
    }

    if (!testOnlyOnePage) {
      console.log("=== Step 3b: Scrape jobs from ANOFM ===");
      const anofmResult = await fetchANOFMJobs(cif);
      sourceHealth.ANOFM = anofmResult.ok;
      for (const job of anofmResult.jobs) {
        if (!rawJobs.find(j => j.url === job.url)) {
          rawJobs.push(job);
        }
      }
    }

    console.log("=== Step 3c: Scrape jobs from Mingle ===");
    const mingleResult = await fetchMingleJobs();
    sourceHealth.Mingle = mingleResult.ok;
    for (const job of mingleResult.jobs) {
      if (!rawJobs.find(j => j.url === job.url)) {
        rawJobs.push(job);
      }
    }

    console.log(`📊 Total unique jobs collected: ${rawJobs.length}`);
    console.log(`📊 Source health: ${JSON.stringify(sourceHealth)}`);

    const jobs = rawJobs.map(job => mapToJobModel(job, cif));
    const payload = {
      source: "utilben.ro",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: cif,
      jobs
    };

    console.log("Transforming jobs for API...");
    const transformedPayload = transformJobsForSOLR(payload);
    const validCount = transformedPayload.jobs.filter(j => j.location).length;
    console.log(`📊 Jobs with valid Romanian locations: ${validCount}`);

    fs.writeFileSync("scraper/jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved scraper/jobs.json");

    const companyData = {
      id: cif,
      company: transformedPayload.company,
      brand: companyConfig.brand || undefined,
      status: status === 'active' ? 'activ' : (status || "activ"),
      location: address ? [address] : companyConfig.location,
      website: companyConfig.website,
      career: companyConfig.career,
      scraperFile: companyConfig.scraperFile,
      lastScraped: new Date().toISOString().split('T')[0]
    };
    const markdown = generateJobsMarkdown(companyData, transformedPayload.jobs);
    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/jobs.md", markdown, "utf-8");
    console.log("Saved docs/jobs.md");

    fs.copyFileSync("scraper/config/company.json", "docs/company.json");
    console.log("Copied scraper/config/company.json → docs/company.json");

    console.log("\n=== Step 6: Upsert jobs to API ===");
    await upsertJobs(transformedPayload.jobs);

    const scrapedUrls = new Set(transformedPayload.jobs.map(job => job.url));
    const staleUrls = getStaleUrls(existingUrls, scrapedUrls, sourceHealth);
    const keptUrls = [...existingUrls].filter(url => !scrapedUrls.has(url) && !staleUrls.includes(url));

    if (keptUrls.length > 0) {
      console.log(`\n⚠️ Kept ${keptUrls.length} existing job(s) because their source failed or was not scraped:`);
      for (const url of keptUrls) {
        console.log(`  Keeping: ${url}`);
      }
    }

    if (staleUrls.length > 0) {
      console.log(`\n=== Step 6.5: Delete ${staleUrls.length} stale job(s) ===`);
      let deletedCount = 0;
      for (const url of staleUrls) {
        try {
          console.log(`  Deleting: ${url}`);
          await deleteJobByUrl(url);
          deletedCount++;
        } catch (delErr) {
          console.warn(`  ⚠️ Failed to delete: ${url} — ${delErr.message}`);
        }
      }
      console.log(`✅ Deleted ${deletedCount}/${staleUrls.length} stale job(s)`);
    } else {
      console.log("\n✅ No stale jobs to delete");
    }

    console.log("\n=== Step 7: Summary ===");

    await new Promise(r => setTimeout(r, 2000));
    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`\n📊 === SUMMARY ===`);
    console.log(`📊 Jobs existing in API before scrape: ${existingCount}`);
    console.log(`📊 Jobs scraped: ${rawJobs.length}`);
    console.log(`📊 Stale jobs attempted: ${staleUrls.length}`);
    console.log(`📊 Jobs in API after scrape: ${finalResult.numFound}`);
    console.log(`====================`);

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

export { mapToJobModel, transformJobsForSOLR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
