"""
sync-photos.py
--------------
Fetches photos from the shared Google Photos album and syncs them into
about-me.html.  Run manually or via the weekly GitHub Actions workflow.

How it works:
  1. Fetches the shared album page and extracts lh3.googleusercontent.com/pw/
     photo URLs.
  2. Merges them with photos-data.json (preserving manually entered place/date).
  3. New photos get placeholder place/date — edit photos-data.json to fill them in.
  4. Rewrites the gallery section in about-me.html between the
     <!-- GALLERY_START --> / <!-- GALLERY_END --> markers.
"""

import re
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
ALBUM_URL       = "https://photos.app.goo.gl/UF1sRLh5ciwiLp1m7"
PHOTOS_DATA     = Path(__file__).parent / "photos-data.json"
ABOUT_ME        = Path(__file__).parent / "about-me.html"
# Display size appended to each lh3 URL.  Change to taste.
# =w900 → width 900 px, height proportional, no crop.
DISPLAY_SIZE    = "=w900"

# Cloudflare Worker URL (no trailing slash).
# Deploy cloudflare-worker/image-proxy.js, then set this to your worker URL,
# e.g.  "https://photos-proxy.yourname.workers.dev"
# Leave empty ("") to link directly to Google's CDN (may rate-limit).
WORKER_URL      = "https://little-forest-1bc3.shivanigowdaks.workers.dev/"
# ────────────────────────────────────────────────────────────────────────────


def fetch_album_urls(album_url: str) -> list[str]:
    """Follow the short link and scrape unique photo base-URLs from the page."""
    req = urllib.request.Request(
        album_url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; photo-sync-bot/1.0)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"[ERROR] Could not fetch album page: {exc}", file=sys.stderr)
        sys.exit(1)

    # Extract lh3 /pw/ URLs (actual photos; /a/ URLs are profile pictures)
    raw = re.findall(r"https://lh3\.googleusercontent\.com/pw/[^\"'\\]+", html)

    seen: set[str] = set()
    base_urls: list[str] = []
    for u in raw:
        # Strip any trailing size/crop params (=w…, =s…, etc.)
        base = re.sub(r"=[wshc]\d.*$", "", u)
        if base not in seen:
            seen.add(base)
            base_urls.append(base)

    return base_urls


def load_photos_data() -> list[dict]:
    if PHOTOS_DATA.exists():
        return json.loads(PHOTOS_DATA.read_text(encoding="utf-8"))
    return []


def save_photos_data(data: list[dict]) -> None:
    PHOTOS_DATA.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def sort_by_date_desc(photos: list[dict]) -> list[dict]:
    """Sort photos newest-first. Photos with unparseable dates go to the end."""
    def parse_date(p: dict):
        raw = p.get("date", "")
        for fmt in ("%B, %Y", "%b, %Y", "%B %Y", "%b %Y"):
            try:
                return datetime.strptime(raw.strip(), fmt)
            except ValueError:
                continue
        return datetime.min  # unparseable → sort last

    return sorted(photos, key=parse_date, reverse=True)


def make_src(lh3_base_url: str) -> str:
    """Build the final image src — via Cloudflare Worker if configured."""
    if WORKER_URL:
        # Extract the /pw/... path from the lh3 URL and route through worker
        path = re.sub(r"^https://lh3\.googleusercontent\.com", "", lh3_base_url)
        return WORKER_URL.rstrip("/") + path + DISPLAY_SIZE
    return lh3_base_url + DISPLAY_SIZE


def build_card(photo: dict) -> str:
    src   = make_src(photo["url"])
    place = photo.get("place") or "Place name"
    date  = photo.get("date")  or "Month, Year"
    alt   = place
    return (
        f'      <div class="photo-card">\n'
        f'        <img class="photo-img" src="{src}" alt="{alt}" loading="lazy">\n'
        f'        <div class="photo-caption">\n'
        f'          <div class="place"><i class="fas fa-map-marker-alt"></i> {place}</div>\n'
        f'          <div class="date"><i class="far fa-calendar-alt"></i> {date}</div>\n'
        f'        </div>\n'
        f'      </div>'
    )


def update_html(photos: list[dict]) -> None:
    html = ABOUT_ME.read_text(encoding="utf-8")

    cards = "\n\n".join(build_card(p) for p in photos)
    replacement = (
        "<!-- GALLERY_START -->\n"
        f'    <div class="gallery-grid">\n\n'
        f"{cards}\n\n"
        "    </div>\n"
        "    <!-- GALLERY_END -->"
    )

    new_html, n = re.subn(
        r"<!-- GALLERY_START -->.*?<!-- GALLERY_END -->",
        replacement,
        html,
        flags=re.DOTALL,
    )

    if n == 0:
        print("[ERROR] Markers <!-- GALLERY_START --> / <!-- GALLERY_END --> not found in about-me.html.", file=sys.stderr)
        sys.exit(1)

    ABOUT_ME.write_text(new_html, encoding="utf-8")


def sync() -> None:
    print(f"Fetching album: {ALBUM_URL}")
    album_urls = fetch_album_urls(ALBUM_URL)
    print(f"  Found {len(album_urls)} photo(s) in album")

    existing      = load_photos_data()
    existing_urls = {p["url"] for p in existing}

    added = 0
    for url in album_urls:
        if url not in existing_urls:
            existing.append({"url": url, "place": "Place name", "date": "Month, Year"})
            existing_urls.add(url)
            added += 1

    if added:
        print(f"  {added} new photo(s) added to photos-data.json")
        save_photos_data(existing)
    else:
        print("  No new photos — photos-data.json unchanged")

    update_html(sort_by_date_desc(existing))
    print(f"  Gallery updated in {ABOUT_ME.name}  ({len(existing)} photo(s) total)")
    if added:
        print("\nRemember to edit photos-data.json to fill in place/date for new photos!")


if __name__ == "__main__":
    sync()
