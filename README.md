# RedTeam AI × MITRE ATT&CK

Visual reference mapping red-team AI agent research papers to MITRE ATT&CK Enterprise techniques.

**Live:** [Deploy to Cloudflare Pages — see setup below]

## What's in here

| Path | Purpose |
|------|---------|
| `app/` | Static SPA → Cloudflare Pages |
| `editor/` | Local admin editor (React + Express) |
| `app/public/papers.json` | All agent + paper + technique data |
| `app/src/data/attack-enterprise.json` | Trimmed MITRE ATT&CK Enterprise v16.1 |

## Cloudflare Pages Setup

1. Fork / push this repo to GitHub
2. In Cloudflare Pages → New Project → Connect to Git
3. Settings:
   - **Root directory:** `app`
   - **Build command:** `npm install && npm run build`
   - **Build output directory:** `dist`
4. Deploy

## Running the editor locally

```bash
cd editor
npm install
npm run dev        # starts frontend :5174 + backend :3001
```

Open http://localhost:5174, select an agent, toggle techniques, save.
Then `cd app && npm run build` → commit + push → CF Pages auto-deploys.

## Updating ATT&CK data (one-time or when MITRE releases new version)

```bash
node scripts/fetch-attack-data.js
git add app/src/data/attack-enterprise.json
git commit -m "chore: update ATT&CK data to vX.X"
```

## License

MIT
