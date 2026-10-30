# Releasing Quill on Cloudflare

Quill is a static Vite application. It needs no backend, database, API key, or paid Worker.

## Workers Static Assets (the current dashboard setup)

If the setup screen has **Deploy command** and **Preview command** fields, use Workers Static Assets:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --assets ./dist --name pdf-toolkit` |
| Enable Preview builds | Off for the initial deployment |
| Path / root directory | `/` |
| Environment variable | `NODE_VERSION=22` |

Leave the preview command blank while previews are disabled. Cloudflare serves the static build at a `workers.dev` URL. The `--assets ./dist` argument selects the output folder; the Path field selects the source folder. The included `_headers` file applies to static asset responses.

The steps below describe the alternative Pages Git integration, which uses a `pages.dev` URL.

## Before pushing

Use Node 22.12+ and npm. `package-lock.json` is the release lockfile.

```sh
npm ci
npm run check
npm audit --audit-level=high
```

The build prepares PDF fonts, image decoders, the English OCR model, and workers from installed dependencies. It writes the deployable site to `dist/`. Do not commit `dist/`, `node_modules/`, or generated `public/runtime/` assets.

## Connect GitHub

In Cloudflare's Workers & Pages dashboard, create a **Pages** project and connect GitHub. Grant access to `santoshP0/pdf-toolkit` and select it.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |
| Environment variable | `NODE_VERSION=22` |

Cloudflare installs dependencies and builds the project on each push. Its Pages server reads `dist/_headers` for the included security and cache policies. The app has no server routes or secrets to configure. Use the generated `pages.dev` URL first, then add a custom domain in the Pages project.

## Verify the first deployment

- Open the deployed HTTPS URL in a clean browser session and on a phone-sized screen.
- Merge and download two sample PDFs; reopen the output.
- Open a mixed-size PDF in the editor; add text, a short note, and a rectangle on different pages. Verify typing, outside-click save, empty-note discard, undo/redo, and exported positions.
- Run OCR on a sample image and scanned PDF, then verify text extraction and downloads.
- Check password protection/unlocking, signatures, and redaction with disposable fixtures.
- In browser Network tools, confirm PDF/OCR/font requests use your own origin and that file contents are never sent in requests. Confirm the console has no CSP errors.
- Revisit the editor to check session restoration. Stored sessions expire after 30 days and are cleared on the next relevant app visit; browsers cannot run cleanup while the site is closed.

The automated checks cover critical editor, text sanitization, compact note sizing, storage, keyboard, and export regressions. The browser checklist remains required before announcing a public release. Revert a bad release using the previous deployment in the Cloudflare Pages dashboard.

## Product limits to communicate

- The editor adds annotations and covers original text visually. Use **Redact PDF** when content must be permanently removed.
- PDF font matching is approximate; export uses supported standard PDF fonts. Some Unicode text and complex scripts need additional font embedding before they can be exported.
- Large PDFs and high-resolution OCR require memory on the user's device. OCR recognizes English.
- Editor sessions persist in the browser, unlike the other tools' temporary processing state. Shared-device users should export or clear the workspace when finished.
