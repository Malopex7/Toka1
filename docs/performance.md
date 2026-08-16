# Toka Platform API Performance & Load Testing Documentation

This document records the design, execution, and results of the end-to-end API performance and concurrency load testing conducted on the Toka African Creator Platform backend service.

---

## 🏗️ Benchmark Methodology

To measure system stability, latencies, and throughput under concurrent load without generating invalid sessions or rate-limiting Firebase endpoints, we implemented a custom, lightweight concurrent HTTP benchmark runner.

### 1. Developer Authentication Bypass (Development Mode Only)
In `backend/src/middlewares/auth.js`, the `protect` and `optionalProtect` middlewares were updated to support the `X-Benchmark-User-Id` header when running under `NODE_ENV === 'development'`:
```javascript
if (process.env.NODE_ENV === 'development' && req.headers['x-benchmark-user-id']) {
  const devUser = await User.findById(req.headers['x-benchmark-user-id']);
  if (devUser) {
    req.user = devUser;
    return next();
  }
}
```
This allows the test suite to simulate multiple active authenticated creators and followers by querying MongoDB and hydrating `req.user` directly from local database user IDs.

### 2. Parameter Auto-Discovery
The benchmark script (`backend/src/scripts/benchmark.js`) automatically connects to MongoDB before executing the test loop to discover:
- Multiple existing active user IDs in the Mongoose database to cycle through.
- At least one video ID in the DB to run comments listing load tests.
This eliminates manual configuration and ensures the benchmark runs correctly in any environment using real database contents.

### 3. Escalating Concurrency Bands
Tests were run sequentially in escalating concurrency bands:
- **Low**: 5 concurrent requests
- **Medium**: 15 concurrent requests
- **High**: 30 concurrent requests

---

## 📊 Benchmark Execution Results

The following table summarizes the throughput (RPS), latencies, and percentiles (p50, p90, p99) measured for each targeted endpoint:

| Endpoint | Concurrency | Requests Per Second (RPS) | Success Rate | Average Latency | Minimum Latency | Maximum Latency | p50 Latency | p90 Latency | p99 Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Followers List API**<br>`GET /api/users/profile/:username/followers` | 5<br>15<br>30 | 3.7/s<br>6.6/s<br>10.4/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 601.6ms<br>1,618.3ms<br>992.9ms | 254.3ms<br>1,401.9ms<br>461.1ms | 1,356.6ms<br>2,272.6ms<br>2,865.2ms | 551.8ms<br>1,574.0ms<br>875.6ms | 1,356.6ms<br>1,944.2ms<br>1,668.1ms | 1,356.6ms<br>2,272.6ms<br>2,865.2ms |
| **Following List API**<br>`GET /api/users/profile/:username/following` | 5<br>15<br>30 | 9.7/s<br>9.3/s<br>29.5/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 456.0ms<br>363.1ms<br>698.6ms | 230.5ms<br>165.3ms<br>553.5ms | 517.2ms<br>1,609.1ms<br>1,013.1ms | 512.0ms<br>235.7ms<br>700.5ms | 517.2ms<br>744.3ms<br>784.7ms | 517.2ms<br>1,609.1ms<br>1,013.1ms |
| **Status Stories Feed API**<br>`GET /api/status/feed` | 5<br>15<br>30 | 3.0/s<br>10.5/s<br>11.4/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 1,167.2ms<br>521.6ms<br>872.1ms | 868.5ms<br>299.0ms<br>445.5ms | 1,642.3ms<br>1,421.5ms<br>2,626.2ms | 871.1ms<br>328.0ms<br>609.1ms | 1,642.3ms<br>1,258.7ms<br>1,558.0ms | 1,642.3ms<br>1,421.5ms<br>2,626.2ms |
| **Status Highlights API**<br>`GET /api/status/highlights/:userId` | 5<br>15<br>30 | 12.2/s<br>36.6/s<br>23.2/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 179.7ms<br>142.9ms<br>166.2ms | 121.4ms<br>119.7ms<br>75.0ms | 410.4ms<br>406.8ms<br>1,285.4ms | 122.3ms<br>122.3ms<br>87.6ms | 410.4ms<br>132.0ms<br>184.6ms | 410.4ms<br>406.8ms<br>1,285.4ms |
| **Main Video Feed API**<br>`GET /api/feed?limit=20` | 5<br>15<br>30 | 4.7/s<br>10.7/s<br>12.7/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 860.4ms<br>911.4ms<br>1,336.3ms | 506.4ms<br>641.7ms<br>691.4ms | 1,054.4ms<br>1,401.8ms<br>2,350.5ms | 881.0ms<br>843.6ms<br>1,391.4ms | 1,054.4ms<br>1,226.1ms<br>1,880.2ms | 1,054.4ms<br>1,401.8ms<br>2,350.5ms |
| **Video Comments Listing API**<br>`GET /api/videos/:videoId/comments` | 5<br>15<br>30 | 13.7/s<br>24.8/s<br>23.3/s | 100% (5/5)<br>100% (15/15)<br>100% (30/30) | 362.4ms<br>425.8ms<br>745.4ms | 360.6ms<br>402.0ms<br>414.1ms | 364.0ms<br>603.9ms<br>1,281.7ms | 362.3ms<br>407.3ms<br>867.0ms | 364.0ms<br>477.2ms<br>900.3ms | 364.0ms<br>603.9ms<br>1,281.7ms |

---

## 📈 Findings & Architectural Analysis

### 1. Verification of Followers Query Fix
Prior to database cleanup, the Followers/Following endpoints suffered from severe latency bottlenecks (exceeding 14 seconds) due to high-resolution raw base64 avatar images (~1MB each) stored directly within MongoDB user records.
- **Result Post-Optimization**: Following the database cleanup and the implementation of client-side 150x150 JPEG compression, the Followers/Following endpoints resolve in under **601ms** on average under low concurrency and maintain a **992.9ms** average under high concurrency (30 parallel requests).
- **RPS Throughput**: Throughput scaled successfully up to **10.4 RPS** (Followers List) and **29.5 RPS** (Following List).

### 2. High-Efficiency Highlight Retrieval
The **Status Highlights API** was discovered to be the most performant endpoint in the system.
- Average latencies remained consistently low (between **142ms** and **179ms**) across all concurrency bands.
- RPS peaked at **36.6 RPS** during medium concurrency.
- **Rationale**: The Highlights query is heavily optimized by querying Mongoose object IDs directly and does not filter by complex sub-document properties or privacy relationship lookups.

### 3. Video Feed Optimization Potential
The **Main Video Feed API** (`GET /api/feed`) returned average latencies ranging from **860ms** to **1,336ms**.
- **Rationale**: The feed query retrieves multiple video documents, performs user hydration/lookup, and handles pagination. Under 30 parallel concurrent requests, latency peaks at 2.3 seconds.
- **Recommendation**: To scale this endpoint beyond 15 RPS, we can introduce Redis query caching on the homepage feed for non-authenticated states and optimize the MongoDB collection indexes for video lookup sorted by `createdAt`.

---

## 🚦 How to Run Benchmarks Locally

To trigger the performance test suite on a local environment:

1. Start the backend dev server:
   ```bash
   npm run dev
   ```
2. In a separate terminal session, execute the benchmark script:
   ```bash
   node src/scripts/benchmark.js
   ```
3. The runner will print concurrent batches and output a markdown table format representing the active performance metrics.
