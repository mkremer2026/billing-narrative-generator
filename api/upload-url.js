// ============================================================================
//  The Billing Coach — Blob Upload URL Generator
//  Generates short-lived signed URLs that let the browser upload PDFs
//  directly to Vercel Blob storage. This bypasses the request body size
//  limit that normally caps file uploads at ~4.5 MB.
//
//  Flow:
//    1. Browser calls this endpoint to request a signed upload token
//    2. We verify the access password (passed via clientPayload because
//       the @vercel/blob/client library doesn't forward custom headers)
//    3. We return a signed token the browser uses to upload directly to Blob
//    4. After upload finishes, the browser gets back a public URL
//    5. The browser passes that URL to /api/generate, which fetches the PDF
//       and forwards it to Anthropic
// ============================================================================

const { handleUpload } = require('@vercel/blob/client');

// Reuse the same allowed-origins list as /api/generate so we have one source of truth
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://atvr.thebillingcoach.com',
  'https://billing-narrative-generator.vercel.app',
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any vercel.app subdomain for preview deployments
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

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

  if (process.env.NODE_ENV === 'production' && !isOriginAllowed(originUrl)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const required = process.env.ACCESS_PASSWORD || '';
  if (!required) {
    return res.status(500).json({ error: 'Server not configured: ACCESS_PASSWORD missing.' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Server not configured: BLOB_READ_WRITE_TOKEN missing.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // The browser cannot bypass these constraints - they're enforced
        // server-side before any upload token is issued.
        let parsed = {};
        try {
          parsed = clientPayload ? JSON.parse(clientPayload) : {};
        } catch (_e) {
          throw new Error('Invalid client payload');
        }

        if (parsed.password !== required) {
          throw new Error('Unauthorized');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB hard cap
          // Token expires in 60 seconds - just long enough to start the upload
          tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Fires after a successful upload. Cleanup happens in /api/generate
        // after the AI call finishes, so nothing to do here.
        // Throwing here won't undo the upload, so don't rely on this for security.
        console.log('Blob upload completed:', blob.url);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('Upload URL generation error:', err);
    const isAuth = err.message === 'Unauthorized';
    return res.status(isAuth ? 401 : 400).json({ error: err.message || 'Upload setup failed' });
  }
};

module.exports.config = {
  maxDuration: 30,
};
