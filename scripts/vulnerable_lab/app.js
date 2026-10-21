/**
 * Authorized Vulnerable Lab Target for Bounty OS
 * Listens on 0.0.0.0:8888
 * Provides:
 * - HTML landing page with links
 * - Reflected XSS vulnerability on /search?q=
 * - Sensitive configuration on /api/v1/config
 * - Robots.txt with disallowed endpoints
 * - Standard server headers
 */

const http = require('http');
const url = require('url');

const PORT = process.env.LAB_PORT || 8888;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Add realistic security headers for reconnaissance detection
  res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
  res.setHeader('X-Powered-By', 'PHP/7.4.3');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
    <title>Authorized Vulnerable Lab — Target System</title>
</head>
<body>
    <h1>Target Vulnerable Web Application</h1>
    <p>Authorized target environment for security auditing and verification.</p>
    <ul>
        <li><a href="/search?q=test">Search Portal</a></li>
        <li><a href="/api/v1/config">System Information</a></li>
        <li><a href="/admin">Administrative Console</a></li>
        <li><a href="/robots.txt">Robots Configuration</a></li>
    </ul>
    <form action="/search" method="GET">
        <input type="text" name="q" placeholder="Search keywords..." />
        <button type="submit">Search</button>
    </form>
</body>
</html>`);
    return;
  }

  // Reflected Cross-Site Scripting (XSS) Vulnerability
  if (pathname === '/search') {
    const query = parsed.query.q || '';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    // Intentionally unescaped query parameter reflects input into HTML
    res.end(`<!DOCTYPE html>
<html>
<head><title>Search Results</title></head>
<body>
    <h2>Search Results for: ${query}</h2>
    <p>Found 0 items matching your query.</p>
    <a href="/">Back to Home</a>
</body>
</html>`);
    return;
  }

  // Sensitive Information Disclosure
  if (pathname === '/api/v1/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      app_name: "LabPortal",
      version: "1.2.0-beta",
      environment: "staging-internal",
      debug: true,
      api_keys: ["key_live_lab_98374298174"]
    }, null, 2));
    return;
  }

  if (pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("User-agent: *\nDisallow: /admin\nDisallow: /backup.tar.gz\nDisallow: /api/v1/config\n");
    return;
  }

  if (pathname === '/admin') {
    res.writeHead(401, { 'Content-Type': 'text/html' });
    res.end("<html><body><h1>401 Unauthorized</h1><p>Admin authentication required.</p></body></html>");
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end("404 Not Found");
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Lab Server] Authorized vulnerable target listening on http://0.0.0.0:${PORT}`);
});
