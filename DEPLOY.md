# Deploying to Hostinger

The tasks app is a **static export** — no Node process, no server. It runs entirely
in the browser against Firebase, so any plain web host can serve it.

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
