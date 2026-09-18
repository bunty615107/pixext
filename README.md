# PixExt

On-device converter for images, documents, spreadsheets, audio, video, archives, and data files. Nothing is uploaded.

Android-style web app: pick a file, choose an output format, download the result.

## Features

- **Images** — PNG, JPEG, WebP, BMP, ICO, GIF, AVIF, SVG
- **Documents** — PDF, DOCX, RTF, HTML, Markdown, plain text
- **Spreadsheets** — CSV, TSV, JSON, XLSX
- **Audio / video** — transcode where the browser allows
- **Archives** — ZIP pack and unpack
- **Recents** stored locally on this device
- Quality, resize, and flatten options for raster images

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a production bundle.

## Privacy

Conversion runs in the browser. Recents stay in IndexedDB on this device.
