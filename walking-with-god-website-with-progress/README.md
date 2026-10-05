# Walking with God Every Day: website with saved progress

What's in this folder:

- `public/`: the app (`index.html`), the owner dashboard (`admin.html`), icons and offline files
- `netlify/functions/`: two small server programs: `progress` (saves each person's checkmarks) and `admin` (dashboard data)
- `netlify/lib/shared.mjs`: helpers used by both
- `netlify.toml`, `package.json`: tell Netlify how to set it up

Progress is stored in **Netlify Blobs**, the storage built into Netlify. There is no separate database to sign up for.

## One-time setup (about 15 minutes, all in the browser)

1. **Put the files on GitHub**
   - Create a free account at github.com and click **New repository**. Name it `walking-with-god`; Private is fine.
   - On the new repository page, click **uploading an existing file**.
   - Drag in everything from this folder (`public`, `netlify`, `netlify.toml`, `package.json`, `README.md`) and click **Commit changes**.
2. **Connect Netlify to GitHub**
   - In Netlify, open your existing site (the one on app.ongodserrands.com).
   - Go to **Site configuration → Build & deploy → Link repository** and choose `walking-with-god`.
   - Leave the build command empty. Netlify reads `netlify.toml` and uses `public` as the publish folder.
3. **Set the dashboard password**
   - Go to **Site configuration → Environment variables → Add a variable**.
   - Key: `ADMIN_PASSWORD`. Value: a long password only you know.
4. **Deploy**
   - Go to **Deploys → Trigger deploy → Deploy site**, and wait for "Published".
5. **Check it**
   - Open https://app.ongodserrands.com. A **Sign in** button appears at the top.
   - Open https://app.ongodserrands.com/admin.html and enter your password to see everyone's progress.

## Updating later

Upload the changed files to the GitHub repository (same "Add file → Upload files" button). Netlify redeploys on its own within a minute or two.

## Privacy

- Each person is stored with the name they typed and their checkmarks.
- The 4-digit code is never stored in readable form; it only unlocks the saved record.
- After 10 wrong tries in 15 minutes, that name is paused, which stops guessing. The dashboard has the same protection.
