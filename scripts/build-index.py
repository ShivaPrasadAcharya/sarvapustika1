#!/usr/bin/env python3
"""Index every real file under Files/ into files-index.js (no duplicated listing in index.html).

* Any file type may be dropped into any folder under Files/ (new folders and loose files are indexed too).
* Manually written values (remarks, openText, downloadText ...) are preserved on every run.
* updatedAt is the file's last git commit time (falls back to the file's modified time).
"""
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Folders that always exist (created if missing). Any other folder inside Files/ is indexed as well.
FOLDERS = ('pdf', 'images', 'docs', 'spreadsheet', 'powerpoints', 'video')
ROOT_FOLDER = 'root'  # files placed directly inside Files/
SYSTEM_NAMES = {'thumbs.db', 'desktop.ini', '.ds_store', 'readme.txt.placeholder'}
AUTO_KEYS = ('path', 'folder', 'name', 'extension', 'size', 'updatedAt', 'uploadedAt')


def read_previous():
    index_path = ROOT / 'files-index.js'
    if not index_path.exists():
        return {}, ''
    source = index_path.read_text(encoding='utf-8')
    prefix = 'window.RAYA_INDEX = '
    if not source.startswith(prefix):
        raise ValueError('files-index.js must start with the catalogue assignment.')
    try:
        previous = json.loads(source[len(prefix):].strip().removesuffix(';'))
    except json.JSONDecodeError as error:
        raise ValueError('files-index.js must contain valid catalogue data to preserve remarks.') from error
    if not isinstance(previous, dict) or not isinstance(previous.get('files'), list):
        raise ValueError('files-index.js must contain a files list to preserve remarks.')
    existing = {entry['path']: entry for entry in previous['files']
                if isinstance(entry, dict) and isinstance(entry.get('path'), str)}
    return existing, previous


def git_dates(*options):
    """Map 'Files/...' path -> ISO time of the newest matching commit."""
    dates = {}
    try:
        out = subprocess.run(
            ['git', '-c', 'core.quotepath=off', 'log', '--format=@@%cI', '--name-only', *options, '--', 'Files'],
            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return dates
    current = None
    for line in out.splitlines():
        if line.startswith('@@'):
            current = line[2:].strip()
        elif line.strip() and current:
            dates.setdefault(line.strip(), current)  # newest commit is listed first
    return dates


def hidden(parts):
    return any(p.startswith('.') for p in parts)


def collect():
    """Yield (folder, path) for every indexable file."""
    base = ROOT / 'Files'
    base.mkdir(exist_ok=True)
    for folder in FOLDERS:
        (base / folder).mkdir(parents=True, exist_ok=True)
    for entry in sorted(base.iterdir()):
        if entry.name.startswith('.') or entry.is_symlink():
            continue
        if entry.is_file():
            yield ROOT_FOLDER, entry
        elif entry.is_dir():
            for path in sorted(entry.rglob('*')):
                if path.is_file() and not path.is_symlink() and not hidden(path.relative_to(entry).parts):
                    yield entry.name, path


def build():
    existing, previous = read_previous()
    dates = git_dates()
    uploads = git_dates('--diff-filter=A', '--no-renames')
    files = []
    for folder, path in collect():
        if path.name.lower() in SYSTEM_NAMES:
            continue
        relative = path.relative_to(ROOT).as_posix()
        stat = path.stat()
        updated = dates.get(relative) or datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
        extra = existing.get(relative, {})
        entry = {'path': relative, 'folder': folder, 'name': path.name,
                 'extension': path.suffix.lstrip('.').lower(), 'size': stat.st_size,
                 'updatedAt': updated, 'uploadedAt': uploads.get(relative) or extra.get('uploadedAt') or updated,
                 'remarks': str(extra.get('remarks', ''))}
        for key, value in extra.items():  # keep openText, downloadText and any other manual field
            if key not in AUTO_KEYS and key != 'remarks' and value not in (None, ''):
                entry[key] = value
        files.append(entry)
    # Keep the old timestamp when nothing changed, so CI does not commit on every run.
    generated = datetime.now(timezone.utc).isoformat()
    if previous.get('files') == files and previous.get('generatedAt'):
        generated = previous['generatedAt']
    index = {'generatedAt': generated, 'files': files}
    # External JavaScript works when index.html is opened locally, as well as on Pages.
    serialized = json.dumps(index, ensure_ascii=False, indent=2).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    (ROOT / 'files-index.js').write_text('window.RAYA_INDEX = ' + serialized + ';\n', encoding='utf-8')
    print(f'Indexed {len(files)} files in {len({f["folder"] for f in files})} folders.')
    return index


def package_site(index):
    destination = ROOT / '_site'
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()
    for filename in ('index.html', 'files-index.js'):
        shutil.copy2(ROOT / filename, destination / filename)
    shutil.copytree(ROOT / 'assets', destination / 'assets')
    for entry in index['files']:
        target = destination / entry['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / entry['path'], target)
    (destination / '.nojekyll').touch()


if __name__ == '__main__':
    index = build()
    if '--site' in sys.argv:
        package_site(index)
