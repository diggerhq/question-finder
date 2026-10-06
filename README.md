# PromptScout

Find queries your search competitors rank for and turn them into source-checked content briefs. Run once, or enable weekly research in your own OpenComputer workspace.

[Deploy on OpenComputer](https://app.opencomputer.dev/new?repository-url=https%3A%2F%2Fgithub.com%2Fdiggerhq%2Fquestion-finder)

## Browser deployment

1. Open the deploy link and sign in to OpenComputer.
2. Add your OpenSEO API key when prompted. Create one at https://app.openseo.so/settings. The managed connection restricts it to https://app.openseo.so.
3. Deploy the template. In the playground, send `Analyze https://yourwebsite.com`.
4. For recurring research, send `enable weekly yourwebsite.com`. To stop monitoring, send `pause weekly yourwebsite.com`.

The weekly schedule runs Mondays at 09:00 America/Los_Angeles. Monitoring starts only when you enable it. Your OpenComputer and OpenSEO accounts pay for your usage. The agent saves a private content queue in your OpenSEO project context. Users with access to the same workspace share the queue. No emails or automatic article publication are configured.

## CLI deployment

Install Node.js 22 or newer, then run `npm ci`, `npx opencomputer login`, and `npx opencomputer link --create-project "Question Finder"`. In your new project, add Production secret `OPENSEO_API_KEY` with allowed origin `https://app.openseo.so`. Run `npm run deploy -- --alias production`.

## Evidence and scope

Ranking data is sampled. Numerical card evidence is checked against provider responses from the current session. Indexed organic ranks carry source dates; live ranks are absolute SERP row positions. Unknown volume stays unknown. A bounded site review cannot establish that no matching content exists anywhere.

## Development

Run `npm run build` and `npm test`. Secret names are declared in `opencomputer/.env.example`; put local values only in ignored `.env.local` files. This repository contains no project binding or credentials.
