import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://host.docker.internal:5173').replace(/\/$/, '');
const API_BASE = (__ENV.API_BASE || `${BASE_URL}/api`).replace(/\/$/, '');
const SEED_PASSWORD = __ENV.SEED_PASSWORD || 'apc_local_seed_only';
const DURATION = __ENV.DURATION || '10m';
const ORIGIN = (__ENV.ORIGIN || BASE_URL).replace(/\/$/, '');
const ROUND_SLUG = __ENV.ROUND_SLUG || 'round-open';
const EVENT_SLUG = __ENV.EVENT_SLUG || 'event-upcoming';

const publicPageDuration = new Trend('public_page_duration', true);
const businessOpDuration = new Trend('business_op_duration', true);

export const options = {
  scenarios: {
    public_browsing: {
      executor: 'constant-vus',
      vus: 14,
      duration: DURATION,
      exec: 'publicBrowsing',
    },
    member_portal: {
      executor: 'constant-vus',
      vus: 4,
      duration: DURATION,
      exec: 'memberPortal',
    },
    public_submissions: {
      executor: 'constant-vus',
      vus: 2,
      duration: DURATION,
      exec: 'publicSubmissions',
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    public_page_duration: ['p(95)<=2500'],
    business_op_duration: ['p(95)<=3000'],
  },
};

function safeJson(res, path, fallback) {
  if (res.status !== 200 || !res.body) return fallback;
  try {
    const val = res.json(path);
    return val ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function trackPublic(res, name) {
  publicPageDuration.add(res.timings.duration);
  check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
  });
}

function trackBusiness(res, name, expectedStatuses = [200, 201]) {
  businessOpDuration.add(res.timings.duration);
  check(res, {
    [`${name}: status há»£p lá»‡`]: (r) => expectedStatuses.includes(r.status),
  });
}

export function publicBrowsing() {
  group('Trang cĂ´ng khai', () => {
    const home = http.get(`${BASE_URL}/`, { tags: { group: 'public' } });
    trackPublic(home, 'Trang chá»§');
    sleep(0.5);

    const newsList = http.get(`${API_BASE}/public/news?page=1&pageSize=12`, { tags: { group: 'public' } });
    trackPublic(newsList, 'Danh sĂ¡ch tin tá»©c');
    const newsItems = safeJson(newsList, 'items', []);
    const newsSlug = newsItems.length > 0 ? newsItems[0].slug : 'post-1';

    const newsDetail = http.get(`${API_BASE}/public/news/${newsSlug}`, { tags: { group: 'public' } });
    trackPublic(newsDetail, 'Chi tiáº¿t tin tá»©c');
    sleep(0.5);

    const eventList = http.get(`${API_BASE}/public/events?page=1&pageSize=12`, { tags: { group: 'public' } });
    trackPublic(eventList, 'Danh sĂ¡ch sá»± kiá»‡n');
    const eventItems = safeJson(eventList, 'items', []);
    const eventSlug = eventItems.length > 0 ? eventItems[0].slug : EVENT_SLUG;

    const eventDetail = http.get(`${API_BASE}/public/events/${eventSlug}`, { tags: { group: 'public' } });
    trackPublic(eventDetail, 'Chi tiáº¿t sá»± kiá»‡n');
    sleep(0.5);

    const projectList = http.get(`${API_BASE}/public/projects?page=1&pageSize=12`, { tags: { group: 'public' } });
    trackPublic(projectList, 'Danh sĂ¡ch dá»± Ă¡n');
    const projectItems = safeJson(projectList, 'items', []);
    const projectSlug = projectItems.length > 0 ? projectItems[0].slug : 'project-1';

    const projectDetail = http.get(`${API_BASE}/public/projects/${projectSlug}`, { tags: { group: 'public' } });
    trackPublic(projectDetail, 'Chi tiáº¿t dá»± Ă¡n');
    sleep(0.5);

    const search = http.get(`${API_BASE}/public/search?q=APC`, { tags: { group: 'public' } });
    trackPublic(search, 'TĂ¬m kiáº¿m cĂ´ng khai');
  });

  sleep(1);
}

export function memberPortal() {
  const username = __VU % 2 === 0 ? 'member.a' : 'member.b';
  const jsonHeaders = { 'Content-Type': 'application/json', Origin: ORIGIN };

  group('ThĂ nh viĂªn Portal', () => {
    const loginRes = http.post(
      `${API_BASE}/auth/login`,
      JSON.stringify({ username, password: SEED_PASSWORD }),
      { headers: jsonHeaders, tags: { group: 'business' } },
    );
    trackBusiness(loginRes, 'ÄÄƒng nháº­p thĂ nh viĂªn', [200]);

    if (loginRes.status === 200) {
      const profile = http.get(`${API_BASE}/portal/me/profile`, { tags: { group: 'business' } });
      trackBusiness(profile, 'Dashboard há»“ sÆ¡', [200]);

      const roles = http.get(`${API_BASE}/portal/me/roles`, { tags: { group: 'business' } });
      trackBusiness(roles, 'Dashboard vai trĂ²', [200]);

      const activity = http.get(`${API_BASE}/portal/me/activity?page=1&pageSize=10`, { tags: { group: 'business' } });
      trackBusiness(activity, 'Dashboard hoáº¡t Ä‘á»™ng', [200]);
      sleep(0.5);

      const events = http.get(`${API_BASE}/portal/events?page=1&pageSize=12`, { tags: { group: 'business' } });
      trackBusiness(events, 'Danh sĂ¡ch sá»± kiá»‡n ná»™i bá»™', [200]);

      const docs = http.get(`${API_BASE}/portal/documents?page=1&pageSize=12`, { tags: { group: 'business' } });
      trackBusiness(docs, 'Danh sĂ¡ch tĂ i liá»‡u ná»™i bá»™', [200]);
      sleep(0.5);

      const logoutRes = http.post(`${API_BASE}/auth/logout`, null, { headers: { Origin: ORIGIN }, tags: { group: 'business' } });
      trackBusiness(logoutRes, 'ÄÄƒng xuáº¥t thĂ nh viĂªn', [204]);
    }
  });

  sleep(1.5);
}

export function publicSubmissions() {
  const jsonHeaders = { 'Content-Type': 'application/json', Origin: ORIGIN };
  const suffix = `${__VU}_${__ITER}_${Date.now()}`;

  group('Ná»™p Ä‘Æ¡n & ÄÄƒng kĂ½ sá»± kiá»‡n', () => {
    const roundRes = http.get(`${API_BASE}/public/recruitment-rounds/${ROUND_SLUG}`, {
      tags: { group: 'public' },
    });
    trackPublic(roundRes, 'Chi tiáº¿t Ä‘á»£t tuyá»ƒn');

    const departments = safeJson(roundRes, 'departments', []);
    const desiredDepartmentId = departments.length > 0 ? departments[0].id : null;

    if (roundRes.status === 200 && desiredDepartmentId) {
      const applyPayload = JSON.stringify({
        applicantName: `á»¨ng viĂªn LoadTest ${suffix}`,
        applicantEmail: `loadtest.apply.${suffix}@example.com`,
        studentId: `LT${String(__VU)}${String(__ITER).padStart(4, '0')}${String(Date.now()).slice(-4)}`,
        faculty: 'CĂ´ng nghá»‡ thĂ´ng tin',
        major: 'An toĂ n thĂ´ng tin',
        cohort: 'K25',
        desiredDepartmentId,
        skills: 'Python, Kiá»ƒm thá»­ pháº§n má»m',
        experience: 'Tham gia dá»± Ă¡n há»c thuáº­t táº¡i trÆ°á»ng',
        answers: {},
        consent: true,
      });

      const applyRes = http.post(
        `${API_BASE}/public/recruitment-rounds/${ROUND_SLUG}/applications`,
        applyPayload,
        { headers: jsonHeaders, tags: { group: 'business' } },
      );
      trackBusiness(applyRes, 'Ná»™p Ä‘Æ¡n á»©ng tuyá»ƒn', [201]);
    }

    sleep(0.5);

    const regPayload = JSON.stringify({
      fullName: `KhĂ¡ch LoadTest ${suffix}`,
      email: `loadtest.event.${suffix}@example.com`,
      studentId: `EV${String(__VU)}${String(__ITER).padStart(4, '0')}${String(Date.now()).slice(-4)}`,
      consent: true,
    });

    const regRes = http.post(
      `${API_BASE}/public/events/${EVENT_SLUG}/registrations`,
      regPayload,
      { headers: jsonHeaders, tags: { group: 'business' } },
    );
    trackBusiness(regRes, 'ÄÄƒng kĂ½ sá»± kiá»‡n cĂ´ng khai', [201]);
  });

  sleep(2);
}


