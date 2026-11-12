import { useCallback, useEffect, useState } from 'react';
import type { VideoCardData } from '@components/parseVideoCards';

/** Override with EXPO_PUBLIC_API_URL in a .env file if the server address changes. */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.90.75.12:8080';

const TIMEOUT_MS = 10_000;

/**
 * Where the backend serves uploaded files (server.js: app.use('/videos', express.static('uploads'))).
 * The API only returns a filename (e.g. "1792194975961.mp4"), so the playable URL is
 * VIDEO_FILE_PATH + filename.
 */
const VIDEO_FILE_PATH = '/videos/';

/* ------------------------------------------------------------------ */
/* Field mapping                                                       */
/* ------------------------------------------------------------------ */
/**
 * Backend field names that can fill each card field. First one found wins.
 */
const ALIASES: Record<keyof VideoCardData, string[]> = {
  id: ['video_id', 'id', 'videoId'],
  thumbnailSrc: ['thumbnailSrc', 'thumbnailUrl', 'thumbnail', 'thumbnail_url'],
  thumbnailAlt: ['thumbnailAlt'],
  category: ['category', 'genre'],
  title: ['title', 'name'],
  creator: ['creator', 'author', 'uploader', 'channel'],
  publishedAt: ['upload_date', 'publishedAt', 'uploadDate', 'createdAt', 'created_at', 'date'],
  publishedLabel: ['publishedLabel'],
  duration: ['duration', 'length'],
  description: ['description', 'summary'],
  videoUrl: ['videoUrl', 'url', 'videoLink', 'video_url', 'link'],
};

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/** "/media/a.mp4" -> "http://server:8080/media/a.mp4". Full URLs are left alone. */
function absolute(url: string): string {
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
}

/** 125 -> "2:05", 3725 -> "1:02:05". Seconds in, text out. */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Turns one backend record into the shape parseVideoCards / DashVidCardList expect. */
export function normalizeVideo(raw: unknown): VideoCardData {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const card: Record<string, string> = {};

  for (const [field, keys] of Object.entries(ALIASES)) {
    const value = pick(record, keys);
    if (value === undefined) continue;

    if (field === 'duration' && typeof value === 'number') {
      card.duration = formatDuration(value);
    } else if (typeof value === 'string' || typeof value === 'number') {
      card[field] = String(value); // ids like 5 become "5"
    }
  }

  // Fields this backend doesn't send directly: build them from what it does send
  if (!card.videoUrl && typeof record.filename === 'string') {
    const file = record.filename;
    // Full URLs (used by the bundled sample data) are kept as-is
    card.videoUrl = /^https?:\/\//.test(file)
      ? file
      : // Encode each folder separately so "hls/1/master.m3u8" keeps its slashes
        `${API_BASE}${VIDEO_FILE_PATH}${file.split('/').map(encodeURIComponent).join('/')}`;
  }

  // The backend saves thumbnail.jpg next to master.m3u8 when it transcodes a video
  if (!card.thumbnailSrc && card.videoUrl && /\/master\.m3u8$/.test(card.videoUrl)) {
    card.thumbnailSrc = card.videoUrl.replace(/master\.m3u8$/, 'thumbnail.jpg');
  }

  if (!card.creator && record.owner_id != null) {
    card.creator = `User ${record.owner_id}`;
  }

  if (!card.category && typeof record.status === 'string' && record.status) {
    card.category = record.status.charAt(0).toUpperCase() + record.status.slice(1);
  }

  if (!card.thumbnailAlt && card.title) {
    card.thumbnailAlt = `Thumbnail for ${card.title}`;
  }

  // Timestamps like "2026-09-12T10:30:00Z" -> "2026-09-12"
  if (card.publishedAt) {
    const match = card.publishedAt.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) card.publishedAt = match[0];
  }

  if (card.thumbnailSrc) card.thumbnailSrc = absolute(card.thumbnailSrc);
  if (card.videoUrl) card.videoUrl = absolute(card.videoUrl);

  return card as VideoCardData;
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Server responded ${res.status} for ${path}`);
    return await res.json();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Could not reach ${API_BASE} (timed out)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turns backend-shaped JSON (the /api/videos response, or the bundled
 * videocards.sample.json) into cards. Accepts a plain array, or common
 * wrappers (Spring pages use "content").
 */
export function toVideoList(json: unknown): VideoCardData[] {
  const list = Array.isArray(json)
    ? json
    : ((json as any)?.content ?? (json as any)?.videos ?? (json as any)?.cards ?? []);
  return (list as unknown[]).map(normalizeVideo);
}

/** GET /api/videos */
export async function fetchVideos(signal?: AbortSignal): Promise<VideoCardData[]> {
  return toVideoList(await getJson('/api/videos', signal));
}

/** GET /api/videos/:id */
export async function fetchVideo(id: string | number, signal?: AbortSignal): Promise<VideoCardData> {
  return normalizeVideo(await getJson(`/api/videos/${id}`, signal));
}

/* ------------------------------------------------------------------ */
/* Hook: loads the videos once, when the screen mounts                 */
/* ------------------------------------------------------------------ */

export function useVideos() {
  const [videos, setVideos] = useState<VideoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setVideos(await fetchVideos(signal));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { videos, loading, error, refetch: () => load() };
}