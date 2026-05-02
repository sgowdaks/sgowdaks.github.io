/**
 * Cloudflare Worker — Google Photos image proxy
 *
 * Proxies lh3.googleusercontent.com /pw/ images so browsers never hit
 * Google's CDN directly (which rate-limits hotlinks).
 *
 * Deploy steps (free tier, no credit card needed):
 *  1. Sign up at https://dash.cloudflare.com  (free)
 *  2. Go to Workers & Pages → Create → "Hello World" worker
 *  3. Paste this entire file into the editor, click Deploy
 *  4. Note your worker URL, e.g.  https://photos-proxy.YOUR_NAME.workers.dev
 *  5. In sync-photos.py set  WORKER_URL = "https://photos-proxy.YOUR_NAME.workers.dev"
 *  6. Run  python3 sync-photos.py  — gallery updates automatically
 *
 * URL scheme handled by this worker:
 *   https://YOUR_WORKER.workers.dev/pw/<PHOTO_ID>=w900
 *   → fetches → https://lh3.googleusercontent.com/pw/<PHOTO_ID>=w900
 *
 * Only /pw/ paths are allowed — everything else returns 404.
 */

const ALLOWED_PREFIX = "/pw/";
const UPSTREAM_BASE  = "https://lh3.googleusercontent.com";

// Cache images on Cloudflare's edge for 7 days
const CACHE_TTL = 60 * 60 * 24 * 7;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Security: only proxy /pw/ photo paths — block everything else
    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return new Response("Not found", { status: 404 });
    }

    const upstreamUrl = UPSTREAM_BASE + url.pathname + url.search;

    // Try Cloudflare cache first   
    const cache = caches.default;
    let response = await cache.match(request);
    if (response) {
      return response;
    }

    // Fetch from Google, mimicking a browser request to avoid blocks
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://photos.google.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    // Build response with cache headers
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    headers.set("Access-Control-Allow-Origin", "*");
    // Remove headers that would prevent Cloudflare from caching
    headers.delete("Set-Cookie");

    response = new Response(upstream.body, {
      status: upstream.status,
      headers,
    });

    // Store in Cloudflare edge cache
    ctx.waitUntil(cache.put(request, response.clone()));

    return response;
  },
};
