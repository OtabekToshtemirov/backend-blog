# K6 Performance Tests for Blog Backend

This directory contains performance and load tests for the blog backend API, written using [k6](https://k6.io/), a modern load testing tool.

## Test Files

- `health-check.js` - Basic API health check tests
- `auth-tests.js` - User registration and authentication tests
- `post-tests.js` - Tests for post CRUD operations
- `comment-tests.js` - Tests for comment CRUD operations
- `run-tests.js` - Consolidated test runner that can run all tests together or individually

## Installation

First, you need to install k6. Visit the [official k6 installation guide](https://k6.io/docs/get-started/installation/) for instructions for your operating system.

### Windows
```powershell
# Using chocolatey
choco install k6

# Or using winget
winget install k6 --source winget
```

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Running Tests

Before running tests, make sure your API server is running.

### Basic Usage

Run all tests with default settings:
```bash
k6 run tests/run-tests.js
```

### Run with Custom API URL

If your API is not running on the default `http://localhost:4444`, you can specify a different URL:
```bash
k6 run -e API_BASE_URL=http://your-api-url tests/run-tests.js
```

### Running Specific Tests

You can select which tests to run using the TEST_MODE environment variable:
```bash
# Run only health check tests
k6 run -e TEST_MODE=health tests/run-tests.js

# Run only authentication tests
k6 run -e TEST_MODE=auth tests/run-tests.js

# Run only post tests
k6 run -e TEST_MODE=posts tests/run-tests.js

# Run only comment tests
k6 run -e TEST_MODE=comments tests/run-tests.js
```

### Running Individual Test Files

You can also run each test file independently:
```bash
k6 run tests/health-check.js
k6 run tests/auth-tests.js
k6 run tests/post-tests.js
k6 run tests/comment-tests.js
```

## Customizing Test Options

You can customize test options via command line flags:

```bash
# Run with 10 virtual users for 30 seconds
k6 run --vus 10 --duration 30s tests/health-check.js

# Run with a specific ramp-up pattern
k6 run --stage 10s:5,1m:5,10s:0 tests/auth-tests.js
```

## Test Output

By default, k6 outputs test results to the console. You can also output to other formats:

```bash
# Output to JSON file
k6 run --out json=results.json tests/run-tests.js

# Output to CSV file
k6 run --out csv=results.csv tests/run-tests.js
```

## Test Thresholds

The tests include performance thresholds that will cause the test to fail if not met:
- 95% of requests must complete within specified time limits 
- Less than 5% of requests can fail

These thresholds can be modified in the individual test files or overridden via command line arguments.

## CI/CD Integration

You can integrate these tests into your CI/CD pipeline. See the [k6 documentation](https://k6.io/docs/integrations/) for integrations with various CI/CD platforms.

### Example GitHub Actions workflow
```yaml
name: Performance Tests
on: [push]
jobs:
  k6_load_test:
    name: k6 Load Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Run k6 tests
        uses: grafana/k6-action@v0.2.0
        with:
          filename: tests/run-tests.js
          flags: -e API_BASE_URL=https://your-staging-api.com
```

## Interpreting Results

After a test run, k6 will display summary statistics including:
- HTTP request metrics
- Response time percentiles
- Threshold results
- Error rates

Look for:
- `http_req_duration` - How long requests are taking
- `http_req_failed` - Error rates
- `checks` - How many of your test assertions passed