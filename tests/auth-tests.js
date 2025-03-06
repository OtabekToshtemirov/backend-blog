import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '1m', target: 5 },  // Ramp up to 5 users over 1 minute
    { duration: '2m', target: 5 },  // Stay at 5 users for 2 minutes
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests must complete below 1s
    'http_req_failed': ['rate<0.05'],     // Less than 5% of requests can fail
  },
};

export default function () {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:4444';
  
  // Generate a random user for testing
  const randomEmail = `test-${randomString(8)}@example.com`;
  const password = 'TestPassword123';
  const fullname = `Test User ${randomString(5)}`;
  
  let token; // Will store authentication token
  
  group('User Registration', function () {
    const registerData = JSON.stringify({
      email: randomEmail,
      password: password,
      fullname: fullname
    });
    
    const registerHeaders = { 'Content-Type': 'application/json' };
    const registerRes = http.post(`${baseUrl}/auth/register`, registerData, { headers: registerHeaders });
    
    check(registerRes, {
      'Registration successful': (r) => r.status === 200,
      'Registration returns token': (r) => JSON.parse(r.body).token !== undefined,
    });
    
    // If the response contains a token, store it for login tests
    if (registerRes.status === 200) {
      try {
        const responseBody = JSON.parse(registerRes.body);
        if (responseBody.token) {
          token = responseBody.token;
        }
      } catch (e) {
        console.error('Failed to parse registration response:', e);
      }
    }
    
    sleep(1);
  });
  
  group('User Login', function () {
    const loginData = JSON.stringify({
      email: randomEmail,
      password: password,
    });
    
    const loginHeaders = { 'Content-Type': 'application/json' };
    const loginRes = http.post(`${baseUrl}/auth/login`, loginData, { headers: loginHeaders });
    
    check(loginRes, {
      'Login successful': (r) => r.status === 200,
      'Login returns token': (r) => JSON.parse(r.body).token !== undefined,
      'Login returns user data': (r) => JSON.parse(r.body).email === randomEmail,
    });
    
    // If the login was successful and there's no token from registration, use the login token
    if (loginRes.status === 200 && !token) {
      try {
        const responseBody = JSON.parse(loginRes.body);
        if (responseBody.token) {
          token = responseBody.token;
        }
      } catch (e) {
        console.error('Failed to parse login response:', e);
      }
    }
    
    sleep(1);
  });
  
  // Only run the authentication check if we have a token
  if (token) {
    group('Authentication Check', function () {
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      const getMeRes = http.get(`${baseUrl}/auth/me`, { headers: authHeaders });
      
      check(getMeRes, {
        'Auth check successful': (r) => r.status === 200,
        'Auth check returns user data': (r) => {
          try {
            const data = JSON.parse(r.body);
            return data.email === randomEmail && data.fullname === fullname;
          } catch (e) {
            return false;
          }
        },
      });
      
      sleep(1);
    });
  }
}