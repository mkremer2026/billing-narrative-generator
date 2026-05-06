// ============================================================================
//  The Billing Coach — Narrative Generator API
//  Serverless function: proxies requests to Anthropic API
//  Runs on Vercel (or any Node.js serverless platform)
// ============================================================================

// --- Configuration (tune these values) --------------------------------------
const CONFIG = {
  // Which Anthropic model to use. Sonnet 4.6 is the right balance of quality/cost.
  model: 'claude-sonnet-4-6',

  // Max tokens in the response. 16000 is plenty for a narrative set.
  maxTokens: 16000,

  // Rate limit: max requests per IP per window
  rateLimitMax: 20,
  rateLimitWindowMs: 60 * 60 * 1000, // 1 hour

  // Max payload size for non-PDF requests (PDFs now bypass this via Blob storage)
  maxBodyBytes: 8 * 1024 * 1024, // 8MB

  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://atvr.thebillingcoach.com',
    'https://billing-narrative-generator.vercel.app',
  ],

  // If true, allow any vercel.app subdomain (useful for preview deployments)
  allowVercelPreviews: true,
};

// --- In-memory rate limit store ---------------------------------------------
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + CONFIG.rateLimitWindowMs });
    return { allowed: true, remaining: CONFIG.rateLimitMax - 1 };
  }

  if (entry.count >= CONFIG.rateLimitMax) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: CONFIG.rateLimitMax - entry.count };
}

// --- Origin check -----------------------------------------------------------
function isOriginAllowed(origin) {
  if (!origin) return false;
  if (CONFIG.allowedOrigins.includes(origin)) return true;
  if (CONFIG.allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

// --- Blob URL resolver ------------------------------------------------------
// Walks the messages array and finds any document blocks that reference a
// PDF in Vercel Blob storage (via pdfBlobUrl). For each one, fetches the PDF,
// converts it to base64, and rewrites the block to the standard Anthropic
// shape. Also collects the URLs so we can delete them after the request
// finishes.
async function resolveBlobUrls(messages) {
  const urlsToCleanup = [];

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block && block.type === 'document' && block.source && block.source.pdfBlobUrl) {
        const blobUrl = block.source.pdfBlobUrl;

        // Validate the URL belongs to our Blob store - prevents SSRF attacks
        // where a malicious client tries to make us fetch arbitrary URLs.
        if (!blobUrl.startsWith('https://') || !blobUrl.includes('.public.blob.vercel-storage.com')) {
          throw new Error('Invalid blob URL');
        }

        const blobResponse = await fetch(blobUrl);
        if (!blobResponse.ok) {
          throw new Error(`Blob fetch failed with status ${blobResponse.status}`);
        }
        const arrayBuffer = await blobResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Replace the source with the standard Anthropic base64 shape
        block.source = {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        };

        urlsToCleanup.push(blobUrl);
      }
    }
  }

  return urlsToCleanup;
}

// --- Main handler -----------------------------------------------------------
module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  const originUrl = origin.match(/^(https?:\/\/[^/]+)/)?.[1] || '';

  if (isOriginAllowed(originUrl)) {
    res.setHeader('Access-Control-Allow-Origin', originUrl);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // ----- Access password check -----
  const provided = req.headers['x-access-password'] || '';
  const required = process.env.ACCESS_PASSWORD || '';
  if (!required) {
    return res.status(500).json({ error: 'Server misconfigured: ACCESS_PASSWORD not set' });
  }
  if (provided !== required) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (process.env.NODE_ENV === 'production' && !isOriginAllowed(originUrl)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return res.status(500).json({
      error: 'Server misconfiguration: API key is missing. Set ANTHROPIC_API_KEY in your Vercel environment variables.',
    });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return res.status(429).json({
      error: `Rate limit reached. Please try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.`,
    });
  }
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (_e) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty "messages" array.' });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      return res.status(400).json({ error: 'Eac
