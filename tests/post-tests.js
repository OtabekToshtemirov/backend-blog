import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 3 }, // Ramp up to 3 users
    { duration: '1m', target: 3 },  // Stay at 3 users
    { duration: '20s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests must complete below 2s
    'http_req_failed': ['rate<0.05'],     // Less than 5% of requests can fail
  },
};

export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:4444';
  
  // Register a test user that we'll use for all operations
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
  
  if (registerRes.status !== 200) {
    console.error(`Registration failed: ${registerRes.status} ${registerRes.body}`);
    return { baseUrl };
  }
  
  // Get the authentication token
  let responseBody;
  try {
    responseBody = JSON.parse(registerRes.body);
  } catch (e) {
    console.error(`Failed to parse registration response: ${e}`);
    return { baseUrl };
  }
  
  const token = responseBody.token;
  
  
  return {
    baseUrl,
    token,
    email,
    password,
    fullname,
  };
}

export default function (data) {
  const { baseUrl, token } = data;
  
  // Skip tests if we don't have a token
  if (!token) {
    console.warn('No authentication token available, skipping post tests');
    return null; // Important: Return null so the caller knows the test didn't complete properly
  }
  
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  let postSlug; // Will store the slug of the created post
  let postId;   // Will store the ID of the created post
  
  group('Create Post', function () {
    // Create post data
    const postTitle = `Test Post ${randomString(8)}`;
    const postDescription = `This is a test post description containing some random text: ${randomString(20)}`;
    const postTags = ['test', 'k6', 'performance'];
    
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
    
    // Check if post creation was successful
    check(createPostRes, {
      'Post creation successful': (r) => r.status === 200,
      'Response includes post data': (r) => {
        try {
          const res = JSON.parse(r.body);
          postSlug = res.slug; // Store the post slug for later tests
          postId = res._id;    // Store the post ID for later tests
          
          return res.title === postTitle && res.description === postDescription;
        } catch (e) {
          console.error(`Failed to parse post response: ${e}`);
          return false;
        }
      },
    });
    
    sleep(1);
  });
  
  group('Get Posts', function () {
    // Get all posts
    const getAllPostsRes = http.get(`${baseUrl}/posts`);
    
    check(getAllPostsRes, {
      'Get all posts successful': (r) => r.status === 200,
      'Response is a JSON array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      },
    });
    
    // Get latest posts
    const getLatestPostsRes = http.get(`${baseUrl}/posts/latest`);
    
    check(getLatestPostsRes, {
      'Get latest posts successful': (r) => r.status === 200,
      'Latest posts response is valid': (r) => r.status === 200 || r.status === 404,
    });
    
    // Get popular posts
    const getPopularPostsRes = http.get(`${baseUrl}/posts/popular`);
    
    check(getPopularPostsRes, {
      'Get popular posts successful': (r) => r.status === 200,
      'Popular posts response is valid': (r) => r.status === 200 || r.status === 404,
    });
    
    sleep(1);
  });
  
  // Only run the following tests if we have a post slug
  if (postSlug) {
    group('Get Single Post', function () {
      // Get the post we created
      const getPostRes = http.get(`${baseUrl}/posts/${postSlug}`);
      
      check(getPostRes, {
        'Get single post successful': (r) => r.status === 200,
        'Retrieved post has correct slug': (r) => {
          try {
            return JSON.parse(r.body).slug === postSlug;
          } catch (e) {
            return false;
          }
        },
      });
      
      sleep(1);
    });
    
    group('Update Post', function () {
      // Update the post
      const updatedTitle = `Updated Test Post ${randomString(8)}`;
      const updateData = JSON.stringify({
        title: updatedTitle,
        description: 'This is an updated description for the test post',
        tags: ['test', 'updated', 'k6'],
        isPublished: true,
      });
      
      const updatePostRes = http.patch(
        `${baseUrl}/posts/${postSlug}`,
        updateData,
        { headers: authHeaders }
      );
      
      check(updatePostRes, {
        'Update post successful': (r) => r.status === 200,
        'Post title updated correctly': (r) => {
          try {
            return JSON.parse(r.body).title === updatedTitle;
          } catch (e) {
            return false;
          }
        },
      });
      
      sleep(1);
    });
    
    group('Like Post', function () {
      // Like the post
      const likePostRes = http.post(
        `${baseUrl}/posts/${postSlug}/like`,
        null,
        { headers: authHeaders }
      );
      
      check(likePostRes, {
        'Like post request successful': (r) => r.status === 200,
      });
      
      sleep(1);
    });
    
    group('Delete Post', function () {
      // Delete the post - but only if this isn't the 'all' test mode
      // so we can preserve the post for comment tests
      if (__ENV.TEST_MODE && __ENV.TEST_MODE.toLowerCase() !== 'all') {
        const deletePostRes = http.del(
          `${baseUrl}/posts/${postSlug}`,
          null,
          { headers: authHeaders }
        );
        
        check(deletePostRes, {
          'Delete post successful': (r) => r.status === 200,
        });
        
        // Verify the post is deleted
        const checkDeletedRes = http.get(`${baseUrl}/posts/${postSlug}`);
        
        check(checkDeletedRes, {
          'Post is deleted': (r) => r.status === 404,
        });
      } else {
        
      }
      
      sleep(1);
    });
  } else {
    console.warn('No post slug available, skipping post detail tests');
  }
  
  // Return the post data for use in other tests
  return { postSlug, postId, token };
}