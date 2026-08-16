import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Video from '../models/Video.js';
import Status from '../models/Status.js';

// Base API URL
const BASE_URL = 'http://localhost:5000';

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully.");

  // 1) Discover parameters in DB
  console.log("Discovering test parameters from database...");
  const users = await User.find({ username: { $ne: '' } }).limit(5).lean();
  if (users.length === 0) {
    console.error("No users found in database to run benchmarks.");
    process.exit(1);
  }

  // Find a video to test comments
  const video = await Video.findOne({}).lean();
  const testVideoId = video ? video._id.toString() : '6a75451117e7999e12f5d9f8'; // fallback

  const testUser = users[0];
  const testUsername = testUser.username;
  const testUserId = testUser._id.toString();

  console.log(`Discovered test parameters:`);
  console.log(`- Test Username: @${testUsername} (${testUserId})`);
  console.log(`- Test Video ID: ${testVideoId}`);
  console.log(`- Discovered Users Count: ${users.length}`);

  // Disconnect so MongoDB doesn't hold open connection limits during concurrent benchmark calls
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB for load test.");

  // Test endpoints definition
  const endpoints = [
    {
      name: "Followers List API",
      url: (userId) => `/api/users/profile/${testUsername}/followers`,
      method: "GET",
      authenticated: false
    },
    {
      name: "Following List API",
      url: (userId) => `/api/users/profile/${testUsername}/following`,
      method: "GET",
      authenticated: false
    },
    {
      name: "Status Stories Feed API",
      url: (userId) => `/api/status/feed`,
      method: "GET",
      authenticated: true
    },
    {
      name: "Status Highlights API",
      url: (userId) => `/api/status/highlights/${testUserId}`,
      method: "GET",
      authenticated: false
    },
    {
      name: "Main Video Feed API",
      url: (userId) => `/api/feed?limit=20`,
      method: "GET",
      authenticated: true
    },
    {
      name: "Video Comments Listing API",
      url: (userId) => `/api/videos/${testVideoId}/comments`,
      method: "GET",
      authenticated: false
    }
  ];

  const concurrencyTiers = [50, 100, 250];
  const results = [];

  console.log("\nStarting benchmark tests...");
  console.log("==========================================");

  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name} (${endpoint.method} ${endpoint.url(testUserId)})`);
    
    for (const concurrency of concurrencyTiers) {
      process.stdout.write(`  Concurrency: ${concurrency} parallel requests... `);
      
      const startTime = performance.now();
      const requestPromises = Array.from({ length: concurrency }).map(async (_, idx) => {
        // Pick a user ID from our list to simulate different users hitting concurrently
        const currentUser = users[idx % users.length];
        const currentUserId = currentUser._id.toString();

        const reqUrl = `${BASE_URL}${endpoint.url(currentUserId)}`;
        const headers = {
          'Content-Type': 'application/json'
        };

        if (endpoint.authenticated) {
          headers['x-benchmark-user-id'] = currentUserId;
        }

        const reqStart = performance.now();
        try {
          const res = await fetch(reqUrl, { method: endpoint.method, headers });
          const reqEnd = performance.now();
          return {
            success: res.status === 200,
            status: res.status,
            latency: reqEnd - reqStart
          };
        } catch (err) {
          const reqEnd = performance.now();
          return {
            success: false,
            status: 0,
            latency: reqEnd - reqStart,
            error: err.message
          };
        }
      });

      const batchResults = await Promise.all(requestPromises);
      const endTime = performance.now();
      const batchDurationSec = (endTime - startTime) / 1000;

      // Calculate stats
      const latencies = batchResults.map(r => r.latency).sort((a, b) => a - b);
      const successCount = batchResults.filter(r => r.success).length;
      const failCount = batchResults.length - successCount;
      
      const sum = latencies.reduce((a, b) => a + b, 0);
      const avgLatency = sum / latencies.length;
      const minLatency = latencies[0];
      const maxLatency = latencies[latencies.length - 1];

      // Percentiles
      const p50 = latencies[Math.floor(latencies.length * 0.50)];
      const p90 = latencies[Math.floor(latencies.length * 0.90)] || maxLatency;
      const p99 = latencies[Math.floor(latencies.length * 0.99)] || maxLatency;
      
      const rps = concurrency / batchDurationSec;

      console.log(`Done. RPS: ${rps.toFixed(1)} | Success: ${successCount}/${concurrency}`);

      results.push({
        endpoint: endpoint.name,
        concurrency,
        successCount,
        failCount,
        avgLatency,
        minLatency,
        maxLatency,
        p50,
        p90,
        p99,
        rps
      });
    }
  }

  // 2) Print Markdown Summary Table
  console.log("\n==========================================");
  console.log("BENCHMARK PERFORMANCE SUMMARY");
  console.log("==========================================\n");

  console.log("| Endpoint | Concurrency | RPS | Success | Avg Latency | Min Latency | Max Latency | p50 | p90 | p99 |");
  console.log("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |");
  
  for (const r of results) {
    console.log(`| ${r.endpoint} | ${r.concurrency} | ${r.rps.toFixed(1)}/s | ${r.successCount}/${r.concurrency} | ${r.avgLatency.toFixed(1)}ms | ${r.minLatency.toFixed(1)}ms | ${r.maxLatency.toFixed(1)}ms | ${r.p50.toFixed(1)}ms | ${r.p90.toFixed(1)}ms | ${r.p99.toFixed(1)}ms |`);
  }

  console.log("\nPerformance test execution finished successfully.");
}

run().catch(console.error);
