# Machi Koro 2

A private multiplayer table for the 2021 Pandasaurus edition. The base-game catalog and authoritative rules run in the local Cloudflare Worker. All 40 base-game cards have original, locally served illustrations. Production verification is tracked through the GitHub Actions release workflow.

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

The browser suite starts the local Worker and serves the compiled assets. It currently tests room creation, independent seats, WebSocket chat, browser reload recovery, a full Worker restart, protected rooms, host removal, mute settings, and the layout of the market, cities, and card details. The game table layout test supplies a fixture. Separate integration tests exercise full real games for two to five seats, reconnects, and rematches. The rule and card evidence is in [RULES_AUDIT.md](RULES_AUDIT.md).

The host can start as soon as two to five players are connected. The starting roster keeps its seats on reconnect and on rematch. During play, a majority of connected players can skip the current turn or end the game in a draw.

Rooms expire after 30 days without a new seat, chat message, or game action. Keep the private link and any password separate. A returning browser uses its saved seat credential.

## Production configuration

Use the existing **machikoro2** Worker and the private **adrianylee/machikoro2** repository. Store `CLOUDFLARE_API_TOKEN` as a GitHub Actions repository secret and `CLOUDFLARE_ACCOUNT_ID` as an Actions variable or secret. In Cloudflare, disconnect the native Git trigger from this Worker. The repository's build command rejects Cloudflare-native builds to prevent a second deploy path.

GitHub Actions validates pull requests to `main`. Each push to `main` can deploy only after the type, unit, bundle, and Playwright checks succeed for that commit. Deployment is serialized and the job checks that the commit is still the current `main`. Credentials are supplied only to the deployment step. A smoke check records the URL and Wrangler version ID and verifies the production home page, API health, and an artwork asset.

Private GitHub Free repositories lack required merge checks. Review the validation result before merging. Failed validation prevents the Actions deployment regardless of merge permissions.

To verify a release, confirm the GitHub run deployed the expected commit. Open the deployed site, create a password-protected test room, join from independent browsers, play through victory, reconnect during play, and rematch. The site hosts the home page publicly and keeps room state behind the private invite and any password the host sets.
