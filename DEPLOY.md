# Deploying

The tasks app is a **static export** - no Node process, no server. It runs entirely
in the browser against Firebase, so any host can serve it.

## Vercel (current target)

1. Go to <https://vercel.com/new> and import
   `abdalrhmanreda25/market-neurons-tasks`.
2. Framework preset is detected as **Next.js**. Leave the build settings alone -
   `npm run build` and the `out/` export are picked up automatically.
3. Deploy.

**No environment variables are required.** The Firebase web config lives in the
committed `.env.production`, so the build works out of the box. Those values are
public by design - they are compiled into the JS bundle and visible to anyone who
opens the site. Security comes from Firestore rules and the Authorized Domains
list, not from hiding them. To point a deployment at a different Firebase project,
set the same `NEXT_PUBLIC_FIREBASE_*` names in the Vercel dashboard; they override
the file.

### After the first deploy

Add the production domain to Firebase Console ->
**Authentication -> Settings -> Authorized domains**, e.g.
`market-neurons-tasks.vercel.app`, plus any custom domain you attach.

Sign-in is rejected from any domain not on that list.

> **Preview deployments:** every branch/PR preview gets its own
> `...-<hash>.vercel.app` URL, and none of them will be authorized, so Google
> sign-in fails there. Either add a specific preview domain when you need one, or
> test sign-in on the production URL and on `localhost`.

The app is `output: 'export'`, which Vercel serves as static files. If you ever
need real server rendering or API routes, drop that line from `next.config.mjs`
and Vercel will build it as a full Next.js app instead.

---

# Hostinger (alternative)

`marketneurons.tech` already runs a different app (the Agri-Intelligence Platform)
on its own Next.js server, so the tasks app lives on its **own subdomain** and does
not touch that site.

## 1. Create the subdomain

hPanel → **Domains → Subdomains** → create `tasks` for `marketneurons.tech`.

Hostinger creates a document root for it, usually one of:

- `/domains/tasks.marketneurons.tech/public_html/`
- `/public_html/tasks/`

Note which one the File Manager shows — you need it in step 3 and for the
deploy workflow.

## 2. Build

```bash
npm run build
```

This produces `out/`. Nothing else in the repo gets uploaded.

## 3. Upload

Upload the **contents** of `out/` into the subdomain's document root — not the
`out` folder itself. So the server ends up with:

```
<document root>/index.html
<document root>/.htaccess        <-- hidden file, easy to miss
<document root>/_next/...
<document root>/login/index.html
<document root>/dashboard/index.html
...
```

In hPanel File Manager, enable **Show hidden files** or `.htaccess` will be left
behind and clean URLs will break.

If you would rather not upload by hand, run the **Deploy to Hostinger** GitHub
Action (see below).

## 4. Authorize the subdomain in Firebase

Firebase Console → **Authentication → Settings → Authorized domains** → Add
`tasks.marketneurons.tech`.

Sign-in is rejected from any domain not on that list. `marketneurons.tech` being
listed does **not** cover the subdomain — it must be added separately.

## GitHub Actions

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `Verify build` (`ci.yml`) | every push / PR | Builds, fails if any page is missing from the export, uploads the whole site as a downloadable **site** artifact |
| `Deploy to Hostinger` (`deploy-hostinger.yml`) | manual only | Builds and uploads `out/` over FTP |

For the deploy workflow, add these repository secrets
(**Settings → Secrets and variables → Actions**):

- `FTP_SERVER` — from hPanel → Files → FTP Accounts
- `FTP_USERNAME`
- `FTP_PASSWORD`

Then run it from the **Actions** tab and set the target directory to the document
root from step 1. It is manual on purpose — it overwrites whatever is at that path.

## Troubleshooting

**404 on every page** — you are looking at a domain that serves something else, or
the files landed in the wrong folder. Check that `index.html` sits directly in the
document root, not inside an `out/` subfolder.

**Home page works, other pages 404** — `.htaccess` did not upload. Re-upload it
with hidden files shown.

**Site loads but sign-in fails** — the domain is missing from Firebase Authorized
domains (step 4).
