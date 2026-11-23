# sarvapustika1

A public file catalogue with five columns: **SN, Folder name, File name, Link, Remarks**.

Site: `https://shivaprasadacharya.github.io/sarvapustika1/`

| Folder              | Files                                     |
| ------------------- | ----------------------------------------- |
| `Files/pdf`         | PDF                                       |
| `Files/images`      | JPG, PNG, WEBP, GIF, SVG and other images |
| `Files/docs`        | DOC, DOCX, ODT, RTF, TXT, MD, HTML        |
| `Files/spreadsheet` | XLS, XLSX, XLSM, ODS, CSV, TSV            |
| `Files/powerpoints` | PPT, PPTX, PPTM, ODP, PPS, PPSX           |
| `Files/video`       | MP4, WEBM, MOV and other short videos     |

Images include HEIC. Any file type in any folder under `Files/` is listed.

## Add files

Open the relevant folder, choose **Add file → Upload files**, then **Commit changes**.
Names may be Nepali, contain spaces, or sit in subfolders. Each commit to `main` rebuilds
the catalogue and republishes via GitHub Pages (watch the **Actions** tab, then refresh).

## Remarks and custom link text

Edit the file's entry in `files-index.js`; these values survive regeneration:

```json
{
  "path": "Files/pdf/My file.pdf",
  "remarks": "Evidence law notes",
  "openText": "Open PDF",
  "downloadText": "Download PDF"
}
```

## Search

Search names and remarks, or use **Advanced search** (all/any words, exact phrases, fields,
file types, exclusions, files with remarks). Case-insensitive, supports Nepali Unicode.
Only metadata is searched, not document contents.

## Access screen

Mobile number and code are set in `assets/access.js` (line 4). This is a browser-side screen
only: files and repository remain public. Sessions last six hours per browser.

## Local use

`python scripts/build-index.py`, then `python -m http.server 8000`.

## Hosting

GitHub Pages with **GitHub Actions** as the source (Settings → Pages). All uploaded files are public.
