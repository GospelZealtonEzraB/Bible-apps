/**
 * Device-side YouTube caption fetch. The same InnerTube/timedtext technique the
 * Worker uses, but run from the phone (a residential IP) — which YouTube blocks
 * far less than the Worker's datacenter IP, so "paste a link" succeeds much more
 * often. React Native's fetch isn't bound by browser CORS, so it can hit these
 * endpoints directly. Returns '' on any failure; the caller falls back to the
 * Worker's best-effort, then to paste.
 */
const YT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';
const YT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function isYoutubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim());
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function captionTracks(videoId: string): Promise<any[]> {
  // 1) InnerTube ANDROID client — usually dodges the consent/geo wall.
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${YT_INNERTUBE_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': YT_UA, 'accept-language': 'en' },
      body: JSON.stringify({ videoId, context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', hl: 'en', gl: 'US' } } }),
    });
    const data: any = await res.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(tracks) && tracks.length) return tracks;
  } catch { /* fall through */ }
  // 2) Watch-page scrape (with consent cookie).
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers: { 'user-agent': YT_UA, 'accept-language': 'en', cookie: 'CONSENT=YES+1' } });
    const html = await res.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (m) return JSON.parse(m[1]);
  } catch { /* fall through */ }
  return [];
}

async function captionText(baseUrl: string): Promise<string> {
  try {
    const r = await fetch(baseUrl + '&fmt=json3', { headers: { 'user-agent': YT_UA } });
    const j: any = await r.json();
    const t = (j.events || []).flatMap((e: any) => (e.segs || []).map((s: any) => s.utf8 || '')).join('');
    if (t.trim()) return stripTags(t);
  } catch { /* fall through */ }
  const r2 = await fetch(baseUrl, { headers: { 'user-agent': YT_UA } });
  const xml = await r2.text();
  const texts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((x) => x[1]);
  return stripTags(texts.join(' '));
}

/** Best-effort transcript for a YouTube URL, fetched from the device. '' on failure. */
export async function fetchYoutubeTranscript(url: string): Promise<string> {
  const id = youtubeId(url);
  if (!id) return '';
  try {
    const tracks = await captionTracks(id);
    if (!tracks.length) return '';
    const track = tracks.find((t) => (t.languageCode || '').startsWith('en')) || tracks[0];
    if (!track?.baseUrl) return '';
    return (await captionText(track.baseUrl)).slice(0, 16000);
  } catch {
    return '';
  }
}
