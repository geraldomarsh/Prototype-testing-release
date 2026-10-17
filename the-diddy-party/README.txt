THE DIDDY PARTY: Vercel + Supabase edition
==========================================

HOW IT WORKS
- Everyone can open the link and view the whole site (squad, stats, results, vote results).
- "＋ Join the squad" (top bar) lets anyone send their card: name, nickname, position, photo, self-rated stats.
- The card is PENDING until you approve it on the Admin page. Approving makes it public and
  their access code live. Use "Copy invite" to paste the code to them on WhatsApp.
- Members sign in with their code in the top bar, can vote once (changeable), never for themselves.

WHAT'S IN THE FOLDER
  public/            the website (this is what Vercel serves)
  api/[...path].js   Vercel function: every /api/... request
  lib/               the server code (handler.js) and storage (store.js)
  supabase-setup.sql run once in Supabase
  dev-server.js      test on your own computer: node dev-server.js  (no account needed)

DEPLOY (about 15 minutes)
1. SUPABASE (free): supabase.com > New project. Then SQL Editor > New query > paste supabase-setup.sql > Run.
   Then Project Settings > API: copy the "Project URL" and the "service_role" secret key.
   (The service_role key is a password for your database. Never put it in the website files or GitHub.)
2. GITHUB: put this whole folder in a repository (the .gitignore already keeps data/ and secrets out).
3. VERCEL: vercel.com > Add New > Project > import the repository. Leave build settings alone.
   Before you click Deploy, open "Environment Variables" and add:
     SUPABASE_URL          = your Project URL
     SUPABASE_SERVICE_KEY  = your service_role key
     ADMIN_CODE            = a code only you know, e.g. MY-SECRET-42
   Deploy. Open the link.
4. Open  your-site.vercel.app/admin.html , enter ADMIN_CODE. The first visit creates the 7 sample
   players with codes; edit or remove them under "Manage the menaces".
5. Changed an environment variable later? Redeploy (Deployments > ... > Redeploy) for it to apply.

TEST ON YOUR COMPUTER FIRST
  node dev-server.js        -> http://localhost:3000  (admin code is printed in the terminal)
  Data is kept in the data/ folder. Do NOT use VS Code Live Server for this: there's no API there,
  so you'd only see the built-in sample squad.

GOOD TO KNOW
- Photos are cropped square and shrunk to ~20 KB in the browser, then stored in the database.
- Join requests are limited: 3 per person per hour, 40 waiting at once, duplicate names refused.
- Wrong-code attempts are limited (8 per 10 minutes per person) for members and admin.
- The data lives in one database row, which is plenty for a friend group (dozens of players),
  not for thousands of users. Supabase's free plan also pauses projects after a week of no use:
  if the site shows an error after a quiet spell, open Supabase and press "Restore".
- Admin > "Download backup" saves everything (including access codes: keep it private).
- If /api/... pages show "404" on Vercel, tell me: the fix is a one-line vercel.json rewrite.
