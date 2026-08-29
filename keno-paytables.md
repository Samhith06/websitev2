# Keno — risk levels and paytables

40 numbers on the board, 10 drawn each round, the player picks 1–10. Four risk levels: **Classic, Low, Medium, High**.

Every table targets a **98% return to player**; the exact figure after rounding sits in the RTP column. Any hit count not listed pays nothing — including, on the higher risk levels, hit counts that feel like they should pay. That is the trade the player is making.

**How the levels differ.** Classic pays on the most hit counts with the lowest ceiling — you win small, often. High pays on the fewest with the highest ceiling — you lose most rounds and occasionally win a lot. Low and Medium sit between. At one and two picks there is only one meaningful outcome, so all four levels converge; that is correct, not a bug.

**Reading a row.** "6 picks, Medium, 4 → 35×" means: with six numbers chosen on Medium, hitting four of them pays 35 times the bet.

**Two caps apply on top of these tables.** Maximum bet is 100 MC and maximum win per round is 20,000 MC. A top-tier multiplier above 200× therefore only pays in full on a bet below the maximum — state that on the paytable rather than letting someone discover it after the round.

**What a 98% return means for the coin economy.** The house keeps 2 coins per 100 wagered. That is a deliberately thin edge — generous to players, and it means the games drain the coin supply slowly. Watch the minted-versus-destroyed figure in admin for the first month: if coins are inflating, the lever to pull is the daily wager cap or the shop prices, not the RTP. Cutting the RTP later feels like a betrayal in a way that raising a shop price does not.

These tables are data, not code: they live in `game_configs` and Matty can change any of them from admin. Changing one changes the RTP, so the admin screen should recompute and display the new figure as he edits.

**Classic**

| Picks | RTP | Paytable — hits → multiplier |
|---|---|---|
| 1 | 98.00% | **1** → 3.92× |
| 2 | 98.02% | **2** → 16.99× |
| 3 | 98.06% | **2** → 5.15× · **3** → 22.8× |
| 4 | 97.91% | **2** → 2.74× · **3** → 8.44× · **4** → 25.99× |
| 5 | 98.14% | **2** → 1.79× · **3** → 4.56× · **4** → 11.62× · **5** → 29.63× |
| 6 | 98.00% | **2** → 1.3× · **3** → 2.94× · **4** → 6.63× · **5** → 14.97× · **6** → 33.78× |
| 7 | 97.97% | **3** → 3.48× · **4** → 6.35× · **5** → 11.58× · **6** → 21.12× · **7** → 38.51× |
| 8 | 98.07% | **3** → 2.42× · **4** → 4.31× · **5** → 7.71× · **6** → 13.76× · **7** → 24.58× · **8** → 43.9× |
| 9 | 97.92% | **3** → 1.79× · **4** → 3.13× · **5** → 5.44× · **6** → 9.48× · **7** → 16.5× · **8** → 28.74× · **9** → 50.05× |
| 10 | 98.14% | **3** → 1.41× · **4** → 2.38× · **5** → 4.04× · **6** → 6.87× · **7** → 11.66× · **8** → 19.79× · **9** → 33.6× · **10** → 57.05× |

**Low**

| Picks | RTP | Paytable — hits → multiplier |
|---|---|---|
| 1 | 98.00% | **1** → 3.92× |
| 2 | 98.02% | **2** → 16.99× |
| 3 | 97.97% | **2** → 2.37× · **3** → 54× |
| 4 | 97.98% | **2** → 1.86× · **3** → 10.98× · **4** → 64.8× |
| 5 | 98.02% | **3** → 8.82× · **4** → 26.19× · **5** → 77.76× |
| 6 | 97.95% | **3** → 4.74× · **4** → 12.8× · **5** → 34.57× · **6** → 93.31× |
| 7 | 97.98% | **4** → 16.89× · **5** → 31.73× · **6** → 59.61× · **7** → 111.97× |
| 8 | 98.04% | **4** → 9.28× · **5** → 18.09× · **6** → 35.3× · **7** → 68.87× · **8** → 134.37× |
| 9 | 98.01% | **5** → 32.28× · **6** → 48.26× · **7** → 72.14× · **8** → 107.85× · **9** → 161.24× |
| 10 | 97.99% | **5** → 17.85× · **6** → 28.76× · **7** → 46.31× · **8** → 74.59× · **9** → 120.14× · **10** → 193.49× |

**Medium**

| Picks | RTP | Paytable — hits → multiplier |
|---|---|---|
| 1 | 98.00% | **1** → 3.92× |
| 2 | 98.02% | **2** → 16.99× |
| 3 | 98.00% | **3** → 80.69× |
| 4 | 98.01% | **3** → 16.28× · **4** → 147.46× |
| 5 | 97.98% | **3** → 7.04× · **4** → 36.46× · **5** → 188.74× |
| 6 | 98.00% | **4** → 33.21× · **5** → 89.57× · **6** → 241.59× |
| 7 | 98.00% | **5** → 153.8× · **6** → 218.08× · **7** → 309.24× |
| 8 | 98.00% | **5** → 62.56× · **6** → 115.71× · **7** → 214.01× · **8** → 395.82× |
| 9 | 98.00% | **6** → 292.23× · **7** → 349.52× · **8** → 418.04× · **9** → 500× |
| 10 | 98.00% | **6** → 128.21× · **7** → 180.17× · **8** → 253.19× · **9** → 355.8× · **10** → 500× |

**High**

| Picks | RTP | Paytable — hits → multiplier |
|---|---|---|
| 1 | 98.00% | **1** → 3.92× |
| 2 | 98.02% | **2** → 16.99× |
| 3 | 98.00% | **3** → 80.69× |
| 4 | 98.02% | **3** → 7.62× · **4** → 295.94× |
| 5 | 98.00% | **4** → 86.26× · **5** → 402.47× |
| 6 | 98.00% | **5** → 482.36× · **6** → 547.36× |
| 7 | 98.00% | **5** → 146.86× · **6** → 330.64× · **7** → 744.41× |
| 8 | 98.00% | **6** → 789.52× · **7** → 888.55× · **8** → 1000× |
| 9 | 98.00% | **6** → 286.63× · **7** → 434.72× · **8** → 659.33× · **9** → 1000× |
| 10 | 98.00% | **6** → 125.28× · **7** → 210.58× · **8** → 353.95× · **9** → 594.94× · **10** → 1000× |
