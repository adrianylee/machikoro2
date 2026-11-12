# Machi Koro 2

Build a private 2–5-player implementation of the 2021 Pandasaurus edition. The supplied English rulebook and the printed base-set cards are authoritative. Record source evidence and unresolved card data in RULES_AUDIT.md. The game includes 86 establishment copies and 20 landmarks. Launch Pad is a separate printed victory effect. Keep publisher artwork out of the app and use original illustrations checked into the repository.

Use strict TypeScript for new gameplay and client code. Keep card definitions, deterministic rule evaluation, presentation, and Cloudflare transport separate. The Worker and SQLite Durable Object enforce every action and own randomness, hidden decks, and persisted state. Use hibernatable WebSockets and private reconnect credentials. Design for stale, repeated, or concurrent client requests and browser refresh. Avoid polling and hosted dependencies.

Follow the chosen Beananza-style split. Keep the market and your city in the main area, with players and tabbed activity in the side area. Make turn actions reachable on phones. Use warm isometric miniature illustrations, local assets, both themes, accessible controls, and reduced-motion support.

Work on a branch and validate changes before merging. The private GitHub repository is adrianylee/machikoro2. Production uses the connected machikoro2 Worker in the user's Cloudflare account. Cloudflare Workers Builds deploys main, and GitHub Actions supplies pre-merge checks. Keep credentials out of tracked files and protect main with required checks or an equivalent gate. Verify the actual deployment and complete multiplayer games before calling the project finished. Keep other games and Workers outside this project's scope.
