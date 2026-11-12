# Rules and card audit

The supplied English **Machi Koro 2 Rulebook**, Pandasaurus Games, 2021, governs the base game (SHA-256 `cc3f3cff08e9726df5aeab9cff662ac19ed8a071fba0e6f9d5116918a958ea33`). Page references use the printed page numbers.

## Card evidence

The owner's photographs `IMG_7039`, `IMG_7040`, `IMG_7042`, `IMG_7043`, and `IMG_7044` show the English base-game print. The rulebook examples and [scans of the printed cards](https://steamcommunity.com/sharedfiles/filedetails/?id=2700724553) corroborate the card faces. The source files and scans are reference material and stay outside the repository. The app uses separately generated art.

Verified fields for all 40 types are in `src/game/catalog.ts`. The low deck has 46 cards, the high deck has 40, and the landmark deck has 20. The reference inventory matched the [independent copy-count list](https://boardgames.stackexchange.com/questions/57642/is-there-a-list-of-cards-for-machi-koro-2) except for the Sushi Bar. The owner counted five Sushi Bars, confirming the physical inventory and the rulebook total of 86 establishments.

| Deck | Verified cards and quantities |
| --- | --- |
| 1–6, five of each | Sushi Bar, Wheat Field, Vineyard, Bakery, Café, Flower Garden, Convenience Store, Forest |
| 1–6, three of each | Flower Shop, Business Center |
| 7–12, five of each | Corn Field, Hamburger Stand, Family Restaurant, Apple Orchard, Mine |
| 7–12, three of each | Stadium, Furniture Factory, Shopping District, Winery, Food Warehouse |
| Landmarks, one of each | Airport, Amusement Park, Charterhouse, Exhibit Hall, Farmers Market, Forge, French Restaurant, Launch Pad, Loan Office, Moving Company, Museum, Observatory, Park, Publisher, Radio Tower, Shopping Mall, Soda Bottling Plant, Tech Startup, Temple, TV Station |

The 20 base-game landmarks fill the published component count. The [publisher's three promo landmarks](https://pandasaurusgames.com/blogs/news/pre-order-machi-koro-2) are outside the base-game catalog.

## Implementation and checks

| Source | Behavior | Local check |
| --- | --- | --- |
| pp. 2–3 | Separate shuffles, five unique stacks per row, five coins, three clockwise opening rounds. | `test/opening.test.js` and `e2e/full-match.spec.ts`. |
| pp. 4–5 | One or two dice. All qualifying copies activate. Red, then blue and green, then purple, then landmarks. | `test/turn.test.js` and `test/match.test.js`. |
| pp. 6–7 | Optional single build, build allowance at zero, tiered costs, refill and exhaustion, immediate third-landmark victory. | `test/opening.test.js`, `test/match.test.js` and `e2e/full-match.spec.ts`. |
| p. 7 | Restaurant payments proceed counterclockwise and stop at available funds before income. | Café example in `test/match.test.js`. |
| p. 8 | Non-stacking extra turns, optional Business Center exchange, Charterhouse checks actual receipts, Moving Company transfers after activations, landmark income bonuses apply to each copy. | Interaction scenarios in `test/match.test.js`. |
| Printed cards | Launch Pad wins immediately. Observatory reduces its cost by five for everyone. Loan Office costs ten and may be built only by the sole player without a landmark. It reduces that player's future landmark costs by two. | Eligibility, discounts and both victory paths in `test/match.test.js`. |

The physical coin denominations are represented as integer balances. The rulebook gives no procedure for exhausting the bank's physical tokens. The app continues to credit printed bank payouts. Park divides balances using whole coins and the bank contributes enough to make every share equal. The turn engine resolves each Shopping District copy against current balances, rechecking the more-than-ten threshold as balances change.
