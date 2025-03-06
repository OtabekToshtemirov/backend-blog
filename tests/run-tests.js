import { check } from 'k6';
import http from 'k6/http';
import { sleep } from 'k6';
import { group, fail } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Import the individual test scenarios
import * as healthCheck from './health-check.js';
import * as authTests from './auth-tests.js';
import * as postTests from './post-tests.js';
import * as commentTests from './comment-tests.js';

// Main test options - can be overridden by command-line arguments
export const options = {
  stages: [
    { duration: '1m', target: 5 },   // Ramp up to 5 users
    { duration: '1m', target: 5 },   // Stay at 5 users for 1 minute
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],     // Less than 5% of requests should fail
  },
  // Tag the test run
  tags: {
    test_type: 'full_api_test',
  },
};

// Shared data between test modules
export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:4444';
  
  console.log(`Setting up tests with base URL: ${baseUrl}`);
  
  // Register a single test user for all tests
  const email = `testuser-${randomString(8)}@example.com`;
  const password = 'TestPassword123';
  const fullname = `Test User ${randomString(5)}`;
  
  const registerData = JSON.stringify({
    email: email,
    password: password,
    fullname: fullname
  });
  
  const registerHeaders = { 'Content-Type': 'application/json' };
  const registerRes = http.post(`${baseUrl}/auth/register`, registerData, { headers: registerHeaders });
  
  let token;
  if (registerRes.status === 200) {
    try {
      const responseBody = JSON.parse(registerRes.body);
      token = responseBody.token;
      console.log('Test user registered successfully with token');
    } catch (e) {
      console.error(`Failed to parse registration response: ${e}`);
    }
  } else {
    console.error(`Registration failed: ${registerRes.status} ${registerRes.body}`);
  }
  
  // If registration failed, try login (in case the user already exists)
  if (!token) {
    const loginData = JSON.stringify({
      email: email,
      password: password,
    });
    
    const loginRes = http.post(`${baseUrl}/auth/login`, loginData, { headers: registerHeaders });
    if (loginRes.status === 200) {
      try {
        const responseBody = JSON.parse(loginRes.body);
        token = responseBody.token;
        console.log('Test user logged in successfully with token');
      } catch (e) {
        console.error(`Failed to parse login response: ${e}`);
      }
    } else {
      console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    }
  }
  
  // Create a test post for comment tests if in 'all' or 'comments' mode
  const testMode = __ENV.TEST_MODE || 'all';
  let postId, postSlug;
  
  if (token && (testMode.toLowerCase() === 'all' || testMode.toLowerCase() === 'comments')) {
    // Create post data
    const postTitle = `Test Post for Run Tests ${randomString(8)}`;
    const postDescription = `This is a test post for running comments: ${randomString(20)}`;
    const postTags = ['test', 'k6', 'performance'];
    
    const postData = JSON.stringify({
      title: postTitle,
      description: postDescription,
      tags: postTags,
      isPublished: true,
    });
    
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    
    // Send request to create a post
    const createPostRes = http.post(
      `${baseUrl}/posts`,
      postData,
      { headers: authHeaders }
    );
    
    if (createPostRes.status === 200) {
      try {
        const postResponse = JSON.parse(createPostRes.body);
        postId = postResponse._id;
        postSlug = postResponse.slug;
        console.log(`Created test post with ID: ${postId}, slug: ${postSlug} for comment tests`);
      } catch (e) {
        console.error(`Failed to parse create post response: ${e}`);
      }
    } else {
      console.error(`Failed to create test post: ${createPostRes.status} ${createPostRes.body}`);
    }
  }
  
  return {
    baseUrl,
    token,
    email,
    password,
    fullname,
    postId,
    postSlug,
    testMode: testMode,
  };
}

export default function(data) {
  const { testMode, baseUrl, token, postId, postSlug } = data;
  
  if (!baseUrl) {
    fail('Base URL is required');
    return;
  }
  
  console.log(`Running tests in mode: ${testMode} with baseUrl: ${baseUrl}`);
  
  if (token) {
    console.log('Tests will run with valid authentication token');
  } else {
    console.warn('No authentication token available, some tests may be skipped');
  }
  
  // Check which tests to run based on TEST_MODE environment variable
  switch(testMode.toLowerCase()) {
    case 'health':
      console.log('Running health check tests only');
      healthCheck.default();
      break;
      
    case 'auth':
      console.log('Running authentication tests only');
      authTests.default();
      break;
      
    case 'posts':
      console.log('Running post tests only');
      if (token) {
        postTests.default(data);
      } else {
        fail('Authentication token required for post tests');
      }
      break;
      
    case 'comments':
      console.log('Running comment tests only');
      if (token) {
        if (postId) {
          console.log(`Running comment tests with existing post ID: ${postId}`);
          commentTests.default({...data});
        } else {
          console.log('No post ID available, comment tests will create their own post');
          commentTests.default({...data});
        }
      } else {
        fail('Authentication token required for comment tests');
      }
      break;
      
    case 'all':
    default:
      console.log('Running all tests');
      
      // Run tests in sequence with appropriate delays
      group('Health Check Tests', () => {
        healthCheck.default();
      });
      sleep(2);
      
      group('Authentication Tests', () => {
        authTests.default();
      });
      sleep(2);
      
      if (token) {
        // Run post tests and collect the created post data
        let postTestData = null;
        
        group('Post Tests', () => {
          postTestData = postTests.default(data);
        });
        sleep(2);
        
        // Run comment tests using either the pre-created post or the one from post tests
        group('Comment Tests', () => {
          // Use postId and postSlug from setup or from post tests if available
          const commentTestData = {
            ...data,
            postId: data.postId || (postTestData && postTestData.postId),
            postSlug: data.postSlug || (postTestData && postTestData.postSlug)
          };
          
          if (commentTestData.postId) {
            console.log(`Running comment tests with post ID: ${commentTestData.postId}`);
            const commentResult = commentTests.default(commentTestData);
            if (commentResult && commentResult.commentId) {
              commentTestData.commentId = commentResult.commentId;
              console.log(`Stored comment ID: ${commentTestData.commentId} for subsequent tests`);
            }
          } else {
            console.warn('No post ID available for comment tests, they may fail');
            commentTests.default(commentTestData);
          }
        });
      } else {
        console.warn('Skipping post and comment tests - no token available');
      }
      break;
  }
}