// ============================================================================
//  The Billing Coach — Access Auth
//  Validates the access password against env var ACCESS_PASSWORD
// ============================================================================

export default function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const required = process.env.ACCESS_PASSWORD || '';

  if (!required) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  if (password === required) {
    return res.status(200).json({ ok: true });
  }

  // Small delay to slow down brute-force attempts
  return new Promise(resolve => {
    setTimeout(() => {
      res.status(401).json({ ok: false });
      resolve();
    }, 500);
  });
}
