# Rules and card audit

The authority is the supplied English **Machi Koro 2 Rulebook**, Pandasaurus Games, 2021 (SHA-256 `cc3f3cff08e9726df5aeab9cff662ac19ed8a071fba0e6f9d5116918a958ea33`). References below use printed page numbers. Printed base-set cards establish card-specific rules and prices. The [publisher](https://pandasaurusgames.com/products/machi-koro-2) confirms the game edition.

## Rulebook coverage

| Pages | Mechanic | Verification |
| --- | --- | --- |
| 2–3 | 86 establishments, 20 landmarks. Three separately shuffled decks and five unique stacks per row. Five starting coins and three clockwise opening rounds. | Supply and opening tests in `test/opening.test.js`. Physical catalog still under audit. |
| 4–5 | One or two dice. Red, blue/green, purple, then landmark activation. Each matching copy activates. | Dice and establishment activation planning tested in test/turn.test.js. Applying effects remains pending. |
| 6–7 | One optional build. Award one coin if empty on entering build. Landmark tier follows owned count. Refill supply from the matching deck until empty or five types are visible. Third landmark wins immediately. | Refill and exhaustion tested. Normal builds pending. |
| 7 | Collect counterclockwise, paying each player up to available funds before the next. | Payment-order primitive tested. Full roll resolution pending. |
| 8 | Extra turns do not stack. Business Center exchange is optional and can include itself. Charterhouse checks actual receipts from all earlier effects. Moving Company transfers after activation. Each eligible copy gets its income bonus. | Pending effect integration and tests. |
| 3 | Launch Pad's printed immediate effect wins the game. | Pending effect integration and tests. Verify its cost interaction with Observatory. |

## Catalog checklist

Evidence notes refer to card faces shown inside the rulebook or explicit clarifications. Several cards require a printed-card reference for fields the rulebook omits. The [inventory transcription](https://boardgames.stackexchange.com/questions/57642/is-there-a-list-of-cards-for-machi-koro-2) is a cross-check for names and quantities. It reports 13 establishment types with five copies and seven with three, totaling 86. Confirm those counts against the physical edition before release.

| Establishment | Rulebook evidence and remaining checks |
| --- | --- |
| Sushi Bar | pp. 3, 5 show red, 1, cost 2, 3 coins from roller. |
| Wheat Field | pp. 3, 5 show blue, 1–2, cost 1, 1 coin. |
| Vineyard | pp. 4–6 show blue, 2, cost 1, 2 coins. |
| Bakery | pp. 3, 5, 7 show green, 2–3, cost 1, 2 coins. |
| Café | pp. 3, 7 show red, 3, cost 1, 2 coins from roller. |
| Flower Garden | p. 3 shows blue, 4, cost 2, 2 coins. |
| Convenience Store | p. 2 gives name and color. Verify activation, price, icon and effect. |
| Forest | p. 2 gives name and color. Verify activation, price, icon and effect. |
| Corn Field | pp. 2, 8 establish blue and 3 base coins. Verify activation, price and icon. |
| Flower Shop | p. 3 shows green, 6, cost 1, 3 coins per eligible establishment. Confirm icon at full resolution. |
| Business Center | pp. 5, 8 show purple, 6, cost 3, optional establishment exchange. |
| Stadium | pp. 2–3 show purple, 7, cost 3, takes 3 coins per opponent. |
| Furniture Factory | pp. 2–3 show green, 8, cost 4, 4 coins per eligible establishment. The required icon is gear. |
| Shopping District | p. 3 shows purple, 8–9, cost 3, takes half rounded down from each opponent holding more than 10. |
| Hamburger Stand | p. 3 shows red, 8, cost 1, 2 coins from roller. |
| Winery | pp. 3, 6 show green, 9, cost 3, 3 coins per fruit establishment. |
| Family Restaurant | p. 2 gives name and color. Verify activation, price, icon and effect. |
| Apple Orchard | p. 6 shows blue, 10, cost 1, 3 coins. |
| Food Warehouse | p. 2 gives name and color. Verify activation, price, icon and effect. |
| Mine | pp. 2, 6 give name, color and relative position. Verify activation, price, icon and effect. |

| Landmark | Rulebook evidence and remaining checks |
| --- | --- |
| Airport | Verify printed costs, timing and effect. |
| Amusement Park | pp. 6, 8 show 12/16/22, ongoing global extra turn on doubles. |
| Charterhouse | pp. 2, 8 show 12/16/22, ongoing global 3 coins on two dice and no income. |
| Exhibit Hall | Verify printed costs, timing and effect. |
| Farmers Market | p. 8 confirms +1 per eligible copy, including Corn Field. Verify cost, scope and affected icon. |
| Forge | p. 8 confirms +1 per eligible copy. Verify cost, scope and affected icon. |
| French Restaurant | pp. 2–3 show 10/14/22, immediate 2 coins from each opponent. |
| Launch Pad | p. 3 shows the alternate win effect. Costs 45/38/25 confirmed on the printed example. |
| Loan Office | p. 3 shows cost 10 and an ongoing builder-only two-coin landmark discount. The buyer must be the only player without a landmark. |
| Moving Company | p. 8 confirms mandatory transfer to the right after activations. Verify price, scope and trigger. |
| Museum | Verify printed costs, timing and effect. |
| Observatory | Verify printed costs and exact Launch Pad discount. |
| Park | Verify printed costs, timing and effect. |
| Publisher | Verify printed costs, timing and effect. |
| Radio Tower | pp. 4, 8 show 12/16/22, immediate extra turn. |
| Shopping Mall | p. 8 confirms +1 per eligible copy. Verify cost, scope and affected icon. |
| Soda Bottling Plant | p. 8 confirms +1 per eligible copy. Verify cost, scope and affected icon. |
| Tech Startup | p. 8 confirms an ongoing source of income. Verify printed costs, trigger and amount. |
| Temple | p. 8 confirms an ongoing source of income. Verify printed costs, trigger and amount. |
| TV Station | Verify printed costs, timing and effect. |
