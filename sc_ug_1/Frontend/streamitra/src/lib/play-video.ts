/**
 * play-video
 *
 * Opens a player overlay and plays the given video. Underneath the player it
 * shows the video's details (category, title, creator, date, description),
 * laid out like the dashvidcard.
 *  - Direct files (.mp4, .webm, .ogg, .mov) play in a <video> element.
 *  - HLS streams (.m3u8) play through hls.js, with a live network stats card
 *    (quality, speed, buffer, per-segment downloads) under the player.
 *  - YouTube and Vimeo links play in an embedded iframe.
 *
 * The details sit outside the video element, so they show in the normal
 * (unmaximized) view and are hidden when the browser's fullscreen button is used.
 *
 * Closes on Esc, backdrop click, or the × button, then returns focus to
 * whatever opened it. Web only (uses the DOM).
 */

export type PlayVideoOptions = {
  /** Shown as the heading and used as the dialog's accessible name. "\n" breaks the line. */
  title?: string;
  category?: string;
  creator?: string;
  /** ISO date, e.g. "2026-09-12". Used for <time dateTime>. */
  publishedAt?: string;
  /** Human-readable date, e.g. "12 September 2026". Falls back to publishedAt. */
  publishedLabel?: string;
  description?: string;
};

import { attachHlsWithStats, isHlsUrl } from "./hls-stats";

let closeCurrent: (() => void) | null = null;

const MUTED = "#b5b5b5";

/** Turns watch/share links into embeddable URLs. Returns null for anything else. */
function toEmbedUrl(url: string): string | null {
  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (youtube) {
    return `https://www.youtube-nocookie.com/embed/${youtube[1]}?autoplay=1&rel=0`;
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

function style(el: HTMLElement, css: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, css);
}

/** Creates an element with inline styles and plain text (textContent, so nothing is parsed as HTML). */
function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: Partial<CSSStyleDeclaration> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  style(node, css);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The details panel shown under the player. Returns null if there is nothing to show. */
function buildInfo(options: PlayVideoOptions): HTMLElement | null {
  const { category, title, creator, publishedAt, publishedLabel, description } = options;
  const date = publishedLabel ?? publishedAt;
  if (!(category || title || creator || date || description)) return null;

  const info = make("div", {
    padding: "20px",
    borderRadius: "8px",
    background: "#181818",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  });

  // Category
  if (category) {
    info.append(
      make(
        "p",
        {
          margin: "0",
          fontSize: "12px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
        },
        category,
      ),
    );
  }

  // Title
  if (title) {
    info.append(
      make(
        "h2",
        {
          margin: "6px 0 0",
          fontSize: "22px",
          lineHeight: "1.25",
          fontWeight: "600",
          whiteSpace: "pre-line",
        },
        title,
      ),
    );
  }

  // Creator · date
  if (creator || date) {
    const meta = make("p", { margin: "8px 0 0", fontSize: "14px", color: MUTED });
    if (creator) meta.append(make("span", {}, creator));
    if (creator && date) meta.append(make("span", { margin: "0 8px" }, "·"));
    if (date) {
      const time = make("time", {}, date);
      if (publishedAt) time.dateTime = publishedAt;
      meta.append(time);
    }
    info.append(meta);
  }

  // Description
  if (description) {
    const section = make("div", {
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: "1px solid rgba(255, 255, 255, 0.12)",
    });
    section.append(
      make(
        "p",
        {
          margin: "0 0 6px",
          fontSize: "12px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
        },
        "About the film",
      ),
      make("p", { margin: "0", fontSize: "15px", lineHeight: "1.55" }, description),
    );
    info.append(section);
  }

  return info;
}

/** Starts playback. Returns a function that closes the player. */
export function playVideo(url: string, options: PlayVideoOptions = {}): () => void {
  if (typeof document === "undefined") return () => {};

  closeCurrent?.(); // only one player at a time

  const plainTitle = options.title?.replace(/\n/g, " ");
  const opener = document.activeElement as HTMLElement | null;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // Backdrop / dialog (scrolls if the content is taller than the window)
  const overlay = make("div", {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    display: "flex",
    overflowY: "auto",
    padding: "64px 24px 24px",
    background: "rgba(0, 0, 0, 0.85)",
  });
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", plainTitle ? `Playing ${plainTitle}` : "Video player");

  // Column holding the player, then the details underneath. Auto margins center it.
  const panel = make("div", {
    width: "min(100%, 1100px)",
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  });

  // Player
  const embed = toEmbedUrl(url);
  let media: HTMLVideoElement | HTMLIFrameElement;
  let destroyHls: (() => void) | null = null;
  let closed = false;

  if (embed) {
    const iframe = document.createElement("iframe");
    iframe.src = embed;
    iframe.title = plainTitle ?? "Video player";
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    media = iframe;
  } else {
    const video = document.createElement("video");
    if (!isHlsUrl(url)) video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    media = video;
  }
  style(media, {
    width: "100%",
    aspectRatio: "16 / 9",
    flexShrink: "0",
    border: "0",
    borderRadius: "8px",
    background: "#000",
  });
  panel.append(media);

  // Details under the player
  const info = buildInfo(options);
  if (info) panel.append(info);

  // HLS: hls.js loads the stream and the stats card goes between the player and the details
  if (media instanceof HTMLVideoElement && isHlsUrl(url)) {
    const video = media;
    attachHlsWithStats(video, url)
      .then((hls) => {
        if (!hls) {
          video.src = url; // no Media Source support (e.g. older iPhones): native HLS, no stats
          return;
        }
        if (closed) return hls.destroy();
        destroyHls = hls.destroy;
        video.after(hls.card);
      })
      .catch(() => {
        if (!closed) video.src = url;
      });
  }

  // Close button (fixed, so it stays visible while the overlay scrolls)
  const closeButton = make("button", {
    position: "fixed",
    top: "16px",
    right: "16px",
    width: "40px",
    height: "40px",
    border: "0",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.15)",
    color: "#fff",
    fontSize: "26px",
    lineHeight: "1",
    cursor: "pointer",
  });
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close video");

  overlay.append(panel, closeButton);
  document.body.append(overlay);
  closeButton.focus();

  function close() {
    closed = true;
    destroyHls?.();
    document.removeEventListener("keydown", onKeyDown, true);
    if (media instanceof HTMLVideoElement) media.pause();
    overlay.remove(); // removing the iframe also stops embedded playback
    document.body.style.overflow = previousOverflow;
    closeCurrent = null;
    opener?.focus?.();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }

  // Close when clicking the dark area, but not the player or details
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  closeButton.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown, true);

  // Browsers may block autoplay with sound; the controls stay visible so the user can press play.
  if (media instanceof HTMLVideoElement && media.src) {
    media.play().catch(() => {});
  }

  closeCurrent = close;
  return close;
}

export default playVideo;