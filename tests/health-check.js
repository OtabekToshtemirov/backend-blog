import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // Virtual Users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
  },
};

export default function () {
  // Base URL - update this to match your environment
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:4444';
  
  // Send GET request to the root endpoint
  const rootRes = http.get(baseUrl);
  check(rootRes, {
    'Root endpoint status is 200': (r) => r.status === 200,
    'Root endpoint response contains "Server ishlamoqda"': (r) => r.body.indexOf('Server ishlamoqda') !== -1,
  });
  
  // Send GET request to the tags endpoint
  const tagsRes = http.get(`${baseUrl}/tags`);
  check(tagsRes, {
    'Tags endpoint status is 200': (r) => r.status === 200,
    'Tags endpoint returns JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  });

  // Send GET request to get posts
  const postsRes = http.get(`${baseUrl}/posts`);
  check(postsRes, {
    'Posts endpoint status is 200 or 404': (r) => r.status === 200 || r.status === 404, // 404 is acceptable if no posts exist
    'Posts endpoint returns JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  });

  // Wait between requests
  sleep(1);
}