/**
 * BarsikChat Ultimate Load & Stress Test
 * ========================================
 * Generates JWT tokens locally (no API rate limit!)
 * Tests HTTP endpoints + WebSocket at scale.
 * 
 * Usage: node ultimate-load-test.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const BASE_URL = 'https://barsikchat.duckdns.org';
const WS_URL = 'wss://barsikchat.duckdns.org/ws/chat';
const JWT_SECRET = 'eLgljYCwezBls4XSOBnDLQsdpLXPFGn5eWaO7tqp7ycjawOd5UzxCiF3+zuTqvB7';
const JWT_EXPIRATION = 86400000; // 24h

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Generate tokens locally ──
function generateToken(username) {
  return jwt.sign(
    { sub: username, role: 'USER', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}

function generateUsers(count) {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({ username: `bulk_${i}`, token: generateToken(`bulk_${i}`) });
  }
  return users;
}

// ── HTTP request helper ──
function req(method, path, body = null, token = null) {
  return new Promise(resolve => {
    const url = new URL(path, BASE_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false,
      timeout: 15000,
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const start = Date.now();
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        const lat = Date.now() - start;
        try { resolve({ s: res.statusCode, d: JSON.parse(d), lat }); }
        catch { resolve({ s: res.statusCode, d, lat }); }
      });
    });
    r.on('error', e => resolve({ s: 0, err: e.code || e.message, lat: Date.now() - start }));
    r.on('timeout', () => { r.destroy(); resolve({ s: 0, err: 'TIMEOUT', lat: 15000 }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}

function printBlock(title, data) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  📊 ${title}`);
  console.log(`${'═'.repeat(65)}`);
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'object') {
      console.log(`  ${k}:`);
      for (const [kk, vv] of Object.entries(v)) {
        console.log(`     ${kk.padEnd(18)} ${vv}`);
      }
    } else {
      console.log(`  ${k.padEnd(20)} ${v}`);
    }
  }
  console.log(`${'═'.repeat(65)}`);
}

// ══════════════════════════════════════
// TEST 1: HTTP Concurrent Requests
// ══════════════════════════════════════
async function testHTTP(users) {
  console.log('\n🚀 TEST 1: HTTP Endpoint Concurrency');
  const BATCH_SIZES = [10, 25, 50, 100, 200];
  const results = [];

  for (const batch of BATCH_SIZES) {
    const batchUsers = users.slice(0, batch);
    const latencies = [];
    let ok = 0, err = 0;
    const errors = {};
    const start = Date.now();

    // Each user: GET /api/rooms + GET /api/chat/contacts + GET /api/rooms/general/history
    const promises = batchUsers.flatMap(u => [
      req('GET', '/api/rooms', null, u.token),
      req('GET', '/api/chat/contacts', null, u.token),
      req('GET', '/api/rooms/general/history', null, u.token),
    ]);

    const resArr = await Promise.all(promises);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    for (const r of resArr) {
      latencies.push(r.lat);
      if (r.s >= 200 && r.s < 300) ok++;
      else {
        err++;
        const label = r.err || `HTTP ${r.s}`;
        errors[label] = (errors[label] || 0) + 1;
      }
    }

    const rps = (resArr.length / parseFloat(elapsed)).toFixed(0);
    results.push({ batch, ok, err, elapsed, rps, p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99), max: Math.max(...latencies), errors });

    console.log(`   ${batch.toString().padEnd(4)} concurrent × 3 endpoints → ${ok}✅ ${err}❌ in ${elapsed}s (${rps} req/s) p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms`);
    
    if (Object.keys(errors).length) {
      for (const [k, v] of Object.entries(errors)) console.log(`        ↳ ${v}× ${k}`);
    }

    await sleep(2000);
  }

  return results;
}

// ══════════════════════════════════════
// TEST 2: WebSocket Connections
// ══════════════════════════════════════
async function testWebSocket(users) {
  console.log('\n🚀 TEST 2: WebSocket Progressive Connections');
  const STEPS = [10, 25, 50, 100, 150, 200, 300, 400, 500];
  const results = [];
  
  for (const target of STEPS) {
    if (target > users.length) break;
    
    const batch = users.slice(0, target);
    const sockets = [];
    let connected = 0, failed = 0;
    const errors = {};
    const start = Date.now();

    // Connect in groups of 50 to avoid thundering herd
    const GROUP_SIZE = 50;
    for (let g = 0; g < batch.length; g += GROUP_SIZE) {
      const group = batch.slice(g, g + GROUP_SIZE);
      const proms = group.map(user => new Promise(resolve => {
        try {
          const ws = new WebSocket(`${WS_URL}?token=${user.token}`, { rejectUnauthorized: false });
          let done = false;
          const timer = setTimeout(() => {
            if (!done) { done = true; failed++; errors['TIMEOUT'] = (errors['TIMEOUT'] || 0) + 1; try { ws.close(); } catch {} resolve(null); }
          }, 20000);
          ws.on('open', () => { if (!done) { done = true; clearTimeout(timer); connected++; sockets.push(ws); resolve(ws); } });
          ws.on('error', e => { if (!done) { done = true; clearTimeout(timer); failed++; const m = (e.code || e.message || '?').slice(0, 40); errors[m] = (errors[m] || 0) + 1; resolve(null); } });
        } catch (e) { failed++; resolve(null); }
      }));
      await Promise.all(proms);
      if (g + GROUP_SIZE < batch.length) await sleep(300);
    }
    
    const connTime = Date.now() - start;

    // Message throughput test: send from up to 100 clients
    let msgSent = 0, msgRecv = 0;
    const msgLatencies = [];
    const COUNT = Math.min(sockets.length, 100);
    
    if (COUNT > 0) {
      const recvProms = sockets.slice(0, COUNT).map((ws, i) => new Promise(resolve => {
        const s = Date.now();
        const h = () => { msgLatencies.push(Date.now() - s); msgRecv++; ws.removeListener('message', h); resolve(); };
        ws.on('message', h);
        setTimeout(() => { ws.removeListener('message', h); resolve(); }, 6000);
      }));

      for (let i = 0; i < COUNT; i++) {
        if (sockets[i]?.readyState === WebSocket.OPEN) {
          sockets[i].send(JSON.stringify({ type: 'CHAT', roomId: 'general', content: `lt_${i}_${target}`, sender: `bulk_${i+1}`, timestamp: new Date().toISOString() }));
          msgSent++;
        }
      }
      await Promise.race([Promise.all(recvProms), sleep(6000)]);
    }

    // Close all
    for (const ws of sockets) { try { ws.close(); } catch {} }

    const errStr = Object.entries(errors).map(([k, v]) => `${v}×${k}`).join(', ') || '—';
    const msgAvgLat = msgLatencies.length ? Math.round(msgLatencies.reduce((a, b) => a + b, 0) / msgLatencies.length) : 0;

    results.push({ target, connected, failed, connTime, msgSent, msgRecv, msgAvgLat, errors });

    console.log(
      `   ${target.toString().padEnd(4)} target → ${connected}✅ ${failed}❌ (${connTime}ms) | msgs: ${msgSent}→${msgRecv} (${msgAvgLat}ms avg) | ${errStr}`
    );

    // Stop if >30% failures beyond 25
    if (failed > target * 0.3 && target > 25) {
      console.log(`\n   ⛔ Breaking point: ${target} target, ${connected} max stable`);
      break;
    }

    await sleep(3000);
  }

  return results;
}

// ══════════════════════════════════════
// TEST 3: Sustained Load (RPS test)
// ══════════════════════════════════════
async function testSustainedLoad(users) {
  console.log('\n🚀 TEST 3: Sustained Load — max RPS for 15 seconds');
  
  const testUsers = users.slice(0, 50);
  const DURATION = 15000;
  const CONCURRENCY = 20; // parallel requests at a time
  
  const latencies = [];
  let ok = 0, err = 0;
  const errors = {};
  const start = Date.now();
  let idx = 0;
  
  while (Date.now() - start < DURATION) {
    const batch = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const u = testUsers[idx % testUsers.length];
      idx++;
      batch.push(req('GET', '/api/rooms', null, u.token));
    }
    
    const results = await Promise.all(batch);
    for (const r of results) {
      latencies.push(r.lat);
      if (r.s >= 200 && r.s < 300) ok++;
      else {
        err++;
        const label = r.err || `HTTP ${r.s}`;
        errors[label] = (errors[label] || 0) + 1;
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const total = ok + err;
  const rps = (total / parseFloat(elapsed)).toFixed(0);

  console.log(`   ${total} requests in ${elapsed}s → ${rps} req/s`);
  console.log(`   ✅ ${ok}  ❌ ${err}  (${((err / total) * 100).toFixed(1)}% error rate)`);
  console.log(`   Latency: p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms max=${Math.max(...latencies)}ms`);
  
  if (Object.keys(errors).length) {
    for (const [k, v] of Object.entries(errors)) console.log(`   ↳ ${v}× ${k}`);
  }

  return { total, ok, err, rps, elapsed, latencies, errors };
}

// ══════════════════════════════════════
// TEST 4: WebSocket Message Throughput
// ══════════════════════════════════════
async function testWsThroughput(users) {
  console.log('\n🚀 TEST 4: WebSocket Message Throughput');
  
  const COUNT = 50; // connections
  const batch = users.slice(0, COUNT);
  const sockets = [];
  
  // Connect
  const proms = batch.map(u => new Promise(resolve => {
    const ws = new WebSocket(`${WS_URL}?token=${u.token}`, { rejectUnauthorized: false });
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(null); }, 15000);
    ws.on('open', () => { clearTimeout(timer); sockets.push(ws); resolve(ws); });
    ws.on('error', () => { clearTimeout(timer); resolve(null); });
  }));
  await Promise.all(proms);
  console.log(`   ${sockets.length}/${COUNT} connected`);

  if (sockets.length < 5) {
    console.log('   ⚠️ Too few connections, skipping');
    return;
  }

  // Rapid-fire messages from each connection
  const MSGS_PER_CLIENT = 20;
  const TOTAL_MSGS = sockets.length * MSGS_PER_CLIENT;
  let sent = 0, received = 0;
  
  // Track received messages
  for (const ws of sockets) {
    ws.on('message', () => { received++; });
  }

  const start = Date.now();
  
  for (let m = 0; m < MSGS_PER_CLIENT; m++) {
    for (let i = 0; i < sockets.length; i++) {
      if (sockets[i]?.readyState === WebSocket.OPEN) {
        sockets[i].send(JSON.stringify({
          type: 'CHAT', roomId: 'general',
          content: `throughput_${m}_${i}`,
          sender: `bulk_${i + 1}`,
          timestamp: new Date().toISOString(),
        }));
        sent++;
      }
    }
    await sleep(50); // small gap between bursts
  }

  // Wait for delivery
  await sleep(5000);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`   Sent: ${sent} messages in ${elapsed}s (${(sent / parseFloat(elapsed)).toFixed(0)} msg/s)`);
  console.log(`   Received: ${received} (fan-out to ${sockets.length} clients)`);
  console.log(`   Expected receives: ~${sent * sockets.length} (each msg broadcast to all)`);
  console.log(`   Delivery rate: ${received > 0 ? ((received / (sent * sockets.length)) * 100).toFixed(1) : 0}%`);

  // Close
  for (const ws of sockets) { try { ws.close(); } catch {} }
  return { sent, received, elapsed, clients: sockets.length };
}

// ══════════════════════════════════════
// MAIN
// ══════════════════════════════════════
async function main() {
  console.log('╔═════════════════════════════════════════════════════════════╗');
  console.log('║     🐱 BarsikChat Ultimate Load Test                      ║');
  console.log('║     Target: barsikchat.duckdns.org                        ║');
  console.log('║     JWT tokens generated locally (no rate limit!)         ║');
  console.log('╚═════════════════════════════════════════════════════════════╝');

  console.log('\n📋 Generating 500 JWT tokens...');
  const users = generateUsers(500);
  console.log(`   ✅ ${users.length} tokens ready\n`);

  // Verify token works
  console.log('   🔍 Verifying token...');
  const test = await req('GET', '/api/rooms', null, users[0].token);
  if (test.s === 200) {
    console.log(`   ✅ Token valid (${test.lat}ms)\n`);
  } else {
    console.log(`   ❌ Token rejected: HTTP ${test.s} — ${JSON.stringify(test.d).slice(0, 200)}`);
    console.log('   Aborting.');
    return;
  }

  const httpResults = await testHTTP(users);
  const wsResults = await testWebSocket(users);
  const sustainedResults = await testSustainedLoad(users);
  const throughputResults = await testWsThroughput(users);

  // ══════════ FINAL REPORT ══════════
  console.log('\n');
  console.log('╔═════════════════════════════════════════════════════════════╗');
  console.log('║              📊 FINAL LOAD TEST REPORT                    ║');
  console.log('╠═════════════════════════════════════════════════════════════╣');
  
  console.log('║ Infrastructure:                                           ║');
  console.log('║  2 vCPU / 2GB RAM / 20GB SSD                             ║');
  console.log('║  Backend: 768MB RAM, JVM 185MB heap, Hikari pool 10      ║');
  console.log('║  PostgreSQL: 512MB RAM, max_connections 100               ║');
  console.log('║  ulimit -n: 1024                                         ║');
  console.log('╠═════════════════════════════════════════════════════════════╣');
  
  // HTTP summary
  const lastHTTP = httpResults[httpResults.length - 1];
  console.log(`║ HTTP Endpoints (max batch: ${lastHTTP.batch}):`.padEnd(60) + '║');
  console.log(`║  Max RPS:     ${lastHTTP.rps}`.padEnd(60) + '║');
  console.log(`║  P50/P95/P99: ${lastHTTP.p50}/${lastHTTP.p95}/${lastHTTP.p99} ms`.padEnd(60) + '║');
  console.log(`║  Error rate:  ${((lastHTTP.err / (lastHTTP.ok + lastHTTP.err)) * 100).toFixed(1)}%`.padEnd(60) + '║');
  
  // WS summary
  if (wsResults.length) {
    const lastWS = wsResults[wsResults.length - 1];
    const maxConn = Math.max(...wsResults.map(r => r.connected));
    console.log('╠═════════════════════════════════════════════════════════════╣');
    console.log(`║ WebSocket Connections:`.padEnd(60) + '║');
    console.log(`║  Max stable:  ${maxConn}`.padEnd(60) + '║');
    console.log(`║  Msg latency: ${lastWS.msgAvgLat} ms avg`.padEnd(60) + '║');
    console.log(`║  Msg delivery: ${lastWS.msgRecv}/${lastWS.msgSent} (${lastWS.msgSent > 0 ? ((lastWS.msgRecv / lastWS.msgSent) * 100).toFixed(0) : 0}%)`.padEnd(60) + '║');
  }

  // Sustained load
  console.log('╠═════════════════════════════════════════════════════════════╣');
  console.log(`║ Sustained Load (15s):`.padEnd(60) + '║');
  console.log(`║  Effective RPS: ${sustainedResults.rps}`.padEnd(60) + '║');
  console.log(`║  Error rate:    ${((sustainedResults.err / sustainedResults.total) * 100).toFixed(1)}%`.padEnd(60) + '║');
  console.log(`║  P95 latency:   ${percentile(sustainedResults.latencies, 95)} ms`.padEnd(60) + '║');
  
  // Throughput
  if (throughputResults) {
    console.log('╠═════════════════════════════════════════════════════════════╣');
    console.log(`║ WS Message Throughput:`.padEnd(60) + '║');
    console.log(`║  ${throughputResults.sent} msgs from ${throughputResults.clients} clients`.padEnd(60) + '║');
    console.log(`║  Delivery: ${throughputResults.received} received`.padEnd(60) + '║');
  }

  console.log('╚═════════════════════════════════════════════════════════════╝');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
