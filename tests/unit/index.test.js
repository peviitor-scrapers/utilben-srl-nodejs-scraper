import { jest } from '@jest/globals';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

function makeJsonResponse(body) {
  return {
    ok: true,
    json: async () => body
  };
}

function makeErrorResponse(status, text) {
  return {
    ok: false,
    status,
    text: async () => text
  };
}

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../scraper/index.js');
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'utilben.ro',
        company: 'utilben srl',
        cif: '18643343',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'utilben srl', cif: '18643343' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('UTILBEN SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('scrapeMingleCareers', () => {
    it('should return jobs from Mingle API', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({
        data: {
          results: [
            {
              id: 29690,
              uid: "sPjIAA",
              title: "Consultant Vanzari- Utilaje Municipale - Sud-ul Romaniei",
              locations: [
                { id: 936, uid: "936", label: "Pitești" },
                { id: 1088, uid: "1088", label: "Ploiești" }
              ]
            },
            {
              id: 28328,
              uid: "qNphiw",
              title: "Consultant Vanzari- Utilaje Municipale - VEST",
              locations: [
                { id: 999, uid: "999", label: "Timișoara" }
              ]
            }
          ]
        }
      }));

      const jobs = await index.scrapeMingleCareers();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].url).toBe("https://utilben.mingle.ro/en/apply/sPjIAA");
      expect(jobs[0].title).toBe("Consultant Vanzari- Utilaje Municipale - Sud-ul Romaniei");
      expect(jobs[0].location).toEqual(["Pitești", "Ploiești"]);
      expect(jobs[0].source).toBe("Mingle");
      expect(jobs[1].url).toBe("https://utilben.mingle.ro/en/apply/qNphiw");
      expect(jobs[1].location).toEqual(["Timișoara"]);
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({ data: { results: [] } }));

      const jobs = await index.scrapeMingleCareers();

      expect(jobs).toEqual([]);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Server Error'));

      const jobs = await index.scrapeMingleCareers();

      expect(jobs).toEqual([]);
    });

    it('should handle missing locations', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({
        data: {
          results: [
            {
              id: 1,
              uid: "abc123",
              title: "No Location Job",
              locations: []
            }
          ]
        }
      }));

      const jobs = await index.scrapeMingleCareers();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].location).toBeUndefined();
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://www.ejobs.ro/user/locuri-de-munca/test-job/123',
        title: 'Senior Developer',
        location: ['Cluj-Napoca'],
        tags: ['Java', 'Spring'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'UTILBEN SRL';
      const COMPANY_CIF = '18643343';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.tags).toEqual(rawJob.tags);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '18643343');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '18643343');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });
});
