# Machi Koro 2

A private multiplayer table for the 2021 Pandasaurus edition. Development is in progress. The local lobby works and the game table can be exercised with a browser fixture. The full card catalog and server-authoritative game are still being implemented.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run build
npm run dev:worker
```

Open the URL printed by Wrangler. Use separate browser profiles to join the same invite as two different players. Local room data is stored by Wrangler. For frontend hot reload, leave Wrangler on port 8787 and run `npm run dev` in a second terminal.

## Validate

```sh
npm run verify
npx playwright install chromium
npx playwright test
```

The browser suite starts the local Worker and serves the compiled assets. It currently tests room creation, independent seats, WebSocket chat, browser reload recovery, and the layout of the market, cities, and card details. The game table layout test supplies a fixture. The rule and card evidence is in [RULES_AUDIT.md](RULES_AUDIT.md).

## Production configuration

Use the existing **machikoro2** Worker and the private **adrianylee/machikoro2** repository. Set Cloudflare Workers Builds to the repository root and the `main` branch. Use Node.js 24, `npm run verify` for the build command, and `npm run deploy` for the deploy command. The Wrangler config declares static assets and the SQLite room migration.

GitHub Actions runs the `Validate / validate` job on pull requests and on `main`. Make this job a required check on `main` once it has run in GitHub. Use Cloudflare's GitHub App and Workers Builds token to deploy. The GitHub validation workflow uses no deployment credentials.

Once the full local acceptance suite passes, confirm the production deployment matches the merged commit. Check `/api/health`, open the live home page, join from separate devices, complete a game, reconnect during play, and start a rematch. The local Wrangler dry run verifies the bundle and binding declaration.
