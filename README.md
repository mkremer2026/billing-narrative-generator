# The Billing Narrative Generator — Deployment Guide

**For Molly Kremer, Esq. · The Billing Coach**

This folder contains everything needed to deploy your Billing Narrative Generator as a live, public-facing tool on your own domain. When it's live, anyone (clients, prospects, attendees of your workshops) can visit a URL like `generator.thebillingcoach.com` and use the tool — without touching Claude.ai.

---

## What's in this folder

```
billing-narrative-app/
├── api/
│   └── generate.js        ← The backend (proxies requests to the Anthropic API)
├── public/
│   └── index.html         ← The frontend (what users see and interact with)
├── vercel.json            ← Deployment config
├── package.json           ← Project info
├── .env.example           ← Template for environment variables
├── .gitignore
└── README.md              ← You are here
```

---

## How it works (30-second overview)

1. A user fills out the form on your site (role, task blurb, guidelines).
2. The frontend sends that data to your backend at `/api/generate`.
3. Your backend adds your Anthropic API key (hidden server-side) and calls the AI.
4. The AI returns a narrative; your backend passes it back to the user.

**Your API key is never visible to users.** It sits safely in Vercel's environment variables. Users just see the pretty interface and get their narratives.

---

## What you'll need before starting

You'll need accounts (all free to start) at three services:

1. **Anthropic Console** — where your API key lives → [console.anthropic.com](https://console.anthropic.com)
2. **GitHub** — stores your code → [github.com](https://github.com)
3. **Vercel** — runs the live site → [vercel.com](https://vercel.com)

**Estimated total time: 30–45 minutes the first time.**

---

## Step 1 — Get your Anthropic API key

1. Go to **[console.anthropic.com](https://console.anthropic.com)** and sign in (create an account if you don't have one).
2. Click **Settings** → **API Keys** in the left sidebar.
3. Click **Create Key**. Name it something like `billing-generator-prod`.
4. **Copy the key immediately** — it starts with `sk-ant-api03-...`. You'll only see it once. Paste it into a secure note somewhere temporary.
5. **Important**: Go to **Settings → Billing** and set a **monthly spend limit** (suggest $25/month to start). This caps your exposure if the tool gets unexpectedly busy or misused. You can always raise it.

**What this costs you in practice**: roughly $0.01 per narrative generation with Sonnet. 100 narratives/day ≈ $30/month. The rate limiting in the code caps each visitor at 20 generations per hour, so casual abuse is automatically blocked.

---

## Step 2 — Put the code on GitHub

GitHub is where Vercel reads your code from. You don't need to know Git.

### Option A: The drag-and-drop way (easiest)

1. Go to **[github.com](https://github.com)** and sign in.
2. Click the **+** icon in the top right → **New repository**.
3. Name it `billing-narrative-generator`. Leave it **Public** or **Private** — either works.
4. **Don't** check "Add a README" (you already have one).
5. Click **Create repository**.
6. On the empty repo page, click the **"uploading an existing file"** link.
7. Drag this entire `billing-narrative-app` folder's contents into the browser (not the folder itself — the files and subfolders inside it).
8. Scroll down and click **Commit changes**.

### Option B: GitHub Desktop (if you want a friendlier app)

Download **[GitHub Desktop](https://desktop.github.com)** → sign in → **File → Add Local Repository** → pick this folder → **Publish repository**.

---

## Step 3 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** and click **Sign Up** (use the "Continue with GitHub" option — fastest).
2. Once signed in, you'll land on your dashboard. Click **Add New...** → **Project**.
3. You'll see a list of your GitHub repositories. Find `billing-narrative-generator` and click **Import**.
4. On the "Configure Project" page:
   - **Framework Preset**: leave as "Other"
   - **Root Directory**: leave as `./`
   - **Build Command**: leave blank
   - **Output Directory**: leave blank
   - Expand **Environment Variables** and add:
     - **Key**: `ANTHROPIC_API_KEY`
     - **Value**: paste the `sk-ant-api03-...` key from Step 1
     - Click **Add**
5. Click **Deploy**.

Vercel will build and deploy in about 30 seconds. When it's done, you'll see confetti and a URL like `billing-narrative-generator-xyz.vercel.app`. **That URL is your live site.**

**Test it**: visit the URL, fill in a task blurb, click Generate. You should get a narrative back.

---

## Step 4 — Connect your custom domain (optional but recommended)

Right now the tool lives at a `vercel.app` URL. Let's make it `generator.thebillingcoach.com` instead.

1. In Vercel, go to your project → **Settings** → **Domains**.
2. In the "Add Domain" box, type `generator.thebillingcoach.com` and click **Add**.
3. Vercel will show you a DNS record to add. It looks something like:
   - **Type**: `CNAME`
   - **Name**: `generator`
   - **Value**: `cname.vercel-dns.com`
4. Go to wherever your `thebillingcoach.com` domain is managed (GoDaddy, Squarespace, Namecheap, etc.) and add that DNS record.
5. Wait 5–30 minutes for DNS to propagate. Vercel will show a green checkmark when it's ready.
6. Your tool is now live at `https://generator.thebillingcoach.com`.

**Alternative**: If your main site is already on Vercel or you want the tool at the root of a new domain like `billingnarrativegenerator.com`, the process is the same — just add that domain.

---

## Step 5 — Lock down the allowed origins

Right now the backend accepts requests from any origin (for testing ease). Once your site is live, you'll want to restrict it to just your domain so no one else can use your API quota.

1. Open `api/generate.js` in GitHub (click the file in your repo).
2. Click the ✏️ pencil icon to edit.
3. Find this section near the top:
   ```javascript
   allowedOrigins: [
     'http://localhost:3000',
     'http://localhost:5173',
     // Add your Vercel preview URL and production URL here after deploying:
     // 'https://billing-narrative-generator.vercel.app',
     // 'https://thebillingcoach.com',
     // 'https://www.thebillingcoach.com',
   ],
   ```
4. Uncomment and update with your actual URLs:
   ```javascript
   allowedOrigins: [
     'https://generator.thebillingcoach.com',
     'https://billing-narrative-generator-xyz.vercel.app',  // your actual Vercel URL
   ],
   ```
5. Scroll down, commit the change. Vercel will auto-redeploy in about 30 seconds.

---

## Using the tool on your existing website

You have a few ways to integrate this with thebillingcoach.com:

**Option 1: Link out** (simplest)
Add a button on your site: "Try the Narrative Generator →" linking to `generator.thebillingcoach.com`. Users get the full branded experience on a subdomain.

**Option 2: Embed as an iframe**
Paste this into a page on your main site:
```html
<iframe
  src="https://generator.thebillingcoach.com"
  style="width:100%; height:1400px; border:none; border-radius:16px;"
  title="Billing Narrative Generator"></iframe>
```

**Option 3: Gate behind a form**
Drive traffic to a landing page where prospects submit their email to access the generator. This turns the tool into a lead magnet.

---

## Updating the tool later

Any time you want to change something (the copy, the look, a prompt, the rate limit):

1. Open the relevant file in GitHub → pencil icon → edit → commit.
2. Vercel will auto-deploy the change in about 30 seconds.

No command line, no local setup.

---

## Monitoring and cost control

**Check usage**: Anthropic Console → **Usage** tab. You'll see daily token consumption and spend.

**Check visits**: Vercel → your project → **Analytics** tab shows traffic.

**Set up spend alerts**: Anthropic Console → **Billing** → set an email alert at e.g. $20/month.

**Adjust rate limits**: Edit `api/generate.js`, find `rateLimitMax: 20` — raise or lower. 20/hour per IP is sensible for a solo-creator tool. If this becomes a core product, consider Upstash Redis for persistent rate limiting (see "Upgrade paths" below).

---

## Upgrade paths (when you outgrow the current setup)

**Persistent rate limiting** — The current in-memory rate limit resets when Vercel's servers go cold (every few minutes of idle). That's fine for a tool with moderate traffic, but if you start getting consistent daily use, swap in **Upstash Redis** (free tier covers 10,000 requests/day). Takes about 15 minutes to wire up — the team at Vercel has a one-click integration.

**Authentication / paywall** — If you ever want to gate the generator behind a login or a "clients only" section, services like **Clerk** or **Auth0** plug in easily. Or route access through your existing BMM portal by requiring a password.

**Analytics** — Vercel Analytics is free and gives you page views. If you want to track "generations per day" or "role selected most often," add **PostHog** (free tier is generous).

**Branding the domain fully** — You could register a dedicated domain like `narrativegenerator.com` and redirect to it. But `generator.thebillingcoach.com` keeps everything under your brand, which is probably better long-term.

---

## Troubleshooting

**"API key is missing" error** — You forgot to add `ANTHROPIC_API_KEY` to Vercel's environment variables. Go to Project → Settings → Environment Variables and add it. Then go to **Deployments** and click "Redeploy" on the latest one.

**"Origin not allowed"** — Your current domain isn't in the `allowedOrigins` list. Either add it (Step 5) or temporarily set `NODE_ENV` to something other than `production` in Vercel env vars.

**"Rate limit exceeded"** — Normal behavior. Either wait, or raise `rateLimitMax` in `api/generate.js`.

**"Request too large"** — Someone uploaded a very large PDF. The default limit is 8MB, which handles most carrier guidelines. Raise `maxBodyBytes` in `api/generate.js` if needed, but Vercel's serverless function cap is 10MB total.

**Generations are slow** — For very large PDFs (300+ pages), the AI can take 30+ seconds. If you hit Vercel's 60-second timeout, either (a) have users paste key excerpts instead of the full PDF, or (b) upgrade to Vercel Pro for longer timeouts.

**Nothing is working and I'm panicking** — Email me a screenshot of the Vercel deployment logs (Project → Deployments → latest → "Function Logs" tab) and the error you're seeing, and we'll sort it out.

---

## What this replaces, what it doesn't

**This replaces**: the need for anyone (you, clients, prospects) to be inside Claude.ai to use the tool.

**This doesn't replace**: the in-Claude version I built first — that's still useful for your own workflows inside Claude (with all your other tools and context). Think of the deployed version as the *public-facing* front door, and the Claude version as your *private studio*.

Both use the exact same ATVR framework and your proprietary Blueprint data.

---

*Molly Kremer, Esq. · The Billing Coach · thebillingcoach.com · All rights reserved 2026*
