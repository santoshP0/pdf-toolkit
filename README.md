# 🗂️ PDF Toolkit

> A fully local, privacy-first PDF toolkit — 20 tools, zero file uploads, runs entirely in your browser.

![Built with React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![100% Local](https://img.shields.io/badge/privacy-100%25%20local-brightgreen?style=flat-square)

---

## ✨ Features

- **20 PDF tools** covering every common workflow
- **100% client-side** — files never leave your machine
- **No accounts, no limits, no watermarks**
- Dark mode support with a sketchbook-style UI
- Favorites system + per-category filtering
- Responsive — works on desktop and tablet

---

## 🛠️ Tools

| Category | Tool | Description |
|---|---|---|
| **Organize** | Merge PDF | Combine several PDFs into one — drag to reorder |
| **Organize** | Split PDF | Pull out page ranges or single pages |
| **Organize** | Organize Pages | Reorder, rotate and delete pages visually |
| **Organize** | Combine Pages | N-up printing — fit 2–16 pages per sheet |
| **Convert** | Images → PDF | Turn JPG & PNG files into one clean PDF |
| **Convert** | PDF → Images | Export every page as PNG or JPG |
| **Convert** | Extract Text | Instantly copy the text layer from digital PDFs |
| **Convert** | OCR Text | AI-powered text recognition for scanned PDFs & images |
| **Convert** | Extract Images | Save all embedded pictures as PNG files |
| **Edit** | PDF Editor | Draw, annotate & add text on any page |
| **Edit** | Page Numbers | Stamp page numbers with custom position & style |
| **Edit** | Rotate PDF | Spin all or chosen pages the right way up |
| **Edit** | Crop PDF | Trim page margins with a live preview |
| **Edit** | Edit Metadata | Set title, author, subject, keywords & more |
| **Optimize** | Compress PDF | Re-encode images to shrink file size |
| **Optimize** | Grayscale | Convert pages to grayscale to save ink |
| **Security** | Watermark | Lay a text watermark over every page |
| **Security** | Sign PDF | Draw, type or upload a signature & place it |
| **Security** | Protect PDF | Add or remove AES-256 password encryption |
| **Security** | Redact PDF | Permanently black out sensitive areas |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22.12+ and npm

### Install & run

```bash
# Clone the repo
git clone https://github.com/santoshP0/pdf-toolkit.git
cd pdf-toolkit

# Install the locked dependencies
npm ci

# Start the dev server
npm run dev
```

Run the release checks:

```bash
npm run check
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---


## 🔒 Privacy

Every operation runs **entirely in your browser** using WebAssembly and JavaScript. Your files are:

- Never uploaded to any server
- Never sent over the network
- Processed locally. Most tools use temporary memory; the editor saves a resumable session in your browser for up to 30 days. Expired sessions are removed when the site next opens the session. Exporting or opening a new file clears the editor session.

Fonts, the PDF worker, PDF image decoders, and English OCR assets are served from the same site. No analytics or file-upload service is included.

## Production release

See [RELEASE.md](RELEASE.md) for Cloudflare Pages settings, verification steps, rollback guidance, and current PDF editing limits. The GitHub workflow runs lint, regression tests, the production build, and the security audit.

The build output is `dist/`. Runtime PDF and OCR assets are generated from the locked npm dependencies during `npm run build`.

---

## 🤝 Contributing

Pull requests are welcome! For larger changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch: `git checkout -b feature/my-new-tool`
3. Commit your changes: `git commit -m 'Add my new tool'`
4. Push: `git push origin feature/my-new-tool`
5. Open a Pull Request

---

## Third-party software

Quill uses open-source PDF, OCR, font, and interface libraries. Their licenses are retained with the deployed runtime assets where required. This repository does not currently include a license grant for Quill's own source.
