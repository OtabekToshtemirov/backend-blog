import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 3 }, // Ramp up to 3 users
    { duration: '1m', target: 3 },  // Stay at 3 users
    { duration: '20s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'], // 95% of requests must complete below 1.5s
    'http_req_failed': ['rate<0.05'],     // Less than 5% of requests can fail
  },
};

export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:4444';
  
  // Register a test user for authentication
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
  
  let token = null;
  if (registerRes.status === 200) {
    try {
      const responseBody = JSON.parse(registerRes.body);
      token = responseBody.token;
      console.log('Comment tests: User registered successfully with token');
    } catch (e) {
      console.error(`Failed to parse registration response: ${e}`);
    }
  } else {
    console.error(`Registration failed: ${registerRes.status} ${registerRes.body}`);
  }
  
  if (!token) {
    // Try to login if registration failed
    const loginData = JSON.stringify({
      email: email,
      password: password,
    });
    
    const loginRes = http.post(`${baseUrl}/auth/login`, loginData, { headers: registerHeaders });
    if (loginRes.status === 200) {
      try {
        const responseBody = JSON.parse(loginRes.body);
        token = responseBody.token;
        console.log('Comment tests: User logged in successfully with token');
      } catch (e) {
        console.error(`Failed to parse login response: ${e}`);
      }
    }
  }
  
  // Only proceed with creating a post if we have authentication
  if (!token) {
    console.error('Failed to get authentication token for comment tests');
    return { baseUrl };
  }
  
  // Create a test post to add comments to
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const postTitle = `Test Post for Comments ${randomString(8)}`;
  const postDescription = `This is a test post for testing comments: ${randomString(20)}`;
  const postTags = ['test', 'comments', 'k6'];
  
  const postData = JSON.stringify({
    title: postTitle,
    description: postDescription,
    tags: postTags,
    isPublished: true,
  });
  
  // Send request to create a post
  const createPostRes = http.post(
    `${baseUrl}/posts`,
    postData,
    { headers: authHeaders }
  );
  
  let postId = null, postSlug = null;
  
  if (createPostRes.status === 200) {
    try {
      const postResponse = JSON.parse(createPostRes.body);
      postId = postResponse._id;
      postSlug = postResponse.slug;
      console.log(`Comment tests: Created test post with ID: ${postId}, slug: ${postSlug}`);
    } catch (e) {
      console.error(`Failed to parse create post response: ${e}`);
    }
  } else {
    console.error(`Failed to create test post: ${createPostRes.status} ${createPostRes.body}`);
  }
  
  // Store the token and post data globally for the test
  if (token && postSlug) {
    console.log('Comment tests: Setup complete with valid token and post slug');
  }
  
  return {
    baseUrl,
    token,
    postId,
    postSlug,
  };
}

export default function (data) {
  const { baseUrl, token, postId, postSlug } = data;
  
  // Skip tests if we don't have required data
  if (!token || !postSlug) {
    console.error('Missing token or post slug, skipping comment tests. Token exists:', !!token, 'Slug exists:', !!postSlug);
    return;
  }
  
  console.log(`Running comment tests with valid token and slug: ${postSlug}`);
  
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  let commentId; // Will store the ID of a created comment
  
  group('Add Comment', function () {
    // Create comment data
    const commentText = `This is a test comment: ${randomString(20)}`;
    
    const commentData = JSON.stringify({
      text: commentText,
      anonymous: false,
    });
    
    // Send request to create a comment - using the post's slug as required by the API
    const createCommentRes = http.post(
      `${baseUrl}/posts/${postSlug}/comments`,
      commentData,
      { headers: authHeaders }
    );
    
    // Check if comment creation was successful
    check(createCommentRes, {
      'Comment creation successful': (r) => r.status === 201,
      'Response includes comment data': (r) => {
        try {
          const res = JSON.parse(r.body);
          commentId = res._id; // Store the comment ID for later tests
          console.log(`Created comment with ID: ${commentId}`);
          return res.text === commentText;
        } catch (e) {
          console.error(`Failed to parse comment response: ${e.message}`);
          console.error(`Response body: ${createCommentRes.body}`);
          return false;
        }
      },
    });
    
    sleep(1);
  });
  
  group('Get Comments', function () {
    // Get comments for the post using the slug
    const getCommentsRes = http.get(`${baseUrl}/posts/${postSlug}/comments`);
    
    check(getCommentsRes, {
      'Get comments successful': (r) => r.status === 200,
      'Response is a JSON array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          console.error(`Failed to parse get comments response: ${e.message}`);
          return false;
        }
      },
    });
    
    // Get all comments (across all posts)
    const getAllCommentsRes = http.get(`${baseUrl}/comments`);
    
    check(getAllCommentsRes, {
      'Get all comments successful': (r) => r.status === 200,
      'All comments response is an array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      },
    });
    
    // Get latest comments
    const getLatestCommentsRes = http.get(`${baseUrl}/comments/latest`);
    
    check(getLatestCommentsRes, {
      'Get latest comments successful': (r) => r.status === 200,
      'Latest comments response is valid': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      }
    });
    
    sleep(1);
  });
  
  // Only run the following tests if we have a comment ID
  if (commentId) {
    group('Edit Comment', function () {
      // Update the comment
      const updatedText = `This is an updated test comment: ${randomString(20)}`;
      const updateData = JSON.stringify({
        text: updatedText
      });
      
      const updateCommentRes = http.patch(
        `${baseUrl}/comments/${commentId}`,
        updateData,
        { headers: authHeaders }
      );
      
      check(updateCommentRes, {
        'Update comment successful': (r) => r.status === 200,
        'Comment text updated correctly': (r) => {
          try {
            return JSON.parse(r.body).text === updatedText;
          } catch (e) {
            console.error(`Failed to parse update comment response: ${e.message}`);
            return false;
          }
        },
      });
      
      sleep(1);
    });
    
    group('Delete Comment', function () {
      // Delete the comment
      const deleteCommentRes = http.del(
        `${baseUrl}/comments/${commentId}`,
        null,
        { headers: authHeaders }
      );
      
      check(deleteCommentRes, {
        'Delete comment successful': (r) => r.status === 200,
        'Response confirms deletion': (r) => {
          try {
            return JSON.parse(r.body).message && JSON.parse(r.body).message.includes('chirildi');
          } catch (e) {
            console.error(`Failed to parse delete comment response: ${e.message}`);
            return false;
          }
        },
      });
      
      sleep(1);
    });
  } else {
    console.warn('No comment ID available, skipping comment edit/delete tests');
  }
  
  // Clean up: Delete the test post
  group('Clean Up', function () {
    const deletePostRes = http.del(
      `${baseUrl}/posts/${postSlug}`,
      null,
      { headers: authHeaders }
    );
    
    check(deletePostRes, {
      'Delete test post successful': (r) => r.status === 200,
    });
  });
}