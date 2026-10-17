THE DIDDY PARTY: running with access codes
===========================================
1. Install Node.js (nodejs.org, version 18 or newer). No npm install needed.
2. In a terminal, inside this folder:   node server.js
3. Open http://localhost:3000  (phones on the same Wi-Fi: use the "On your Wi-Fi" address it prints)
4. The terminal prints the ADMIN CODE. Open the Admin page, unlock "Voting & who voted",
   and you'll see every player's access code. Send each player their own code.

Players: enter code on the home page -> vote (one vote each, can change it, can't vote for self).
Admin: sees who has / hasn't voted, can copy "still to vote", close voting, start a new poll,
add/remove players, make a new code for someone (the old one stops working).

Notes
- Do NOT use Live Server for this: voting needs server.js. (Live Server still shows the rest of the site.)
- Data lives in data/db.json (contains the codes). Don't share or publish that file. Back it up.
- To set your own admin code:  ADMIN_CODE=MY-CODE node server.js   (Windows PowerShell: $env:ADMIN_CODE="MY-CODE"; node server.js)
- To change the port: PORT=8080 node server.js
- To host it online later: any Node host works (Render, Railway, Fly.io). Use HTTPS and keep data/ on a persistent disk.
- Player names for voting are managed in the Admin "Voting" panel (separate from the squad editor).
