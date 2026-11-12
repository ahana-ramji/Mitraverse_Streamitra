import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "@styles/dashvidcard.css";
import { playVideo } from "../lib/play-video";
import { isHlsUrl } from "../lib/hls-stats";

export type VideoCardProps = {
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  category?: string;
  title?: string;
  creator?: string;
  publishedAt?: string;
  publishedLabel?: string;
  duration?: string;
  description?: string;
  /** The video this card plays (direct file, YouTube, or Vimeo link). */
  videoUrl?: string;
  /** Optional extra callback, runs just before the video starts. */
  onPlay?: () => void;
  className?: string;
};

/** Cuts the description off after 3 lines with an ellipsis. */
const CLAMP_LINES = 3;
const clampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: CLAMP_LINES,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export default function VideoCard({
  thumbnailSrc,
  thumbnailAlt = "",
  category,
  title = "Untitled video",
  creator,
  publishedAt,
  publishedLabel,
  duration,
  description,
  videoUrl,
  onPlay,
  className = "",
}: VideoCardProps) {
  const titleId = useId();
  const plainTitle = title.replace(/\n/g, " ");
  const dateText = publishedLabel ?? publishedAt;

  // "Read more" opens the play-video display, which shows the full description,
  // so the description is only clamped when the card has a video to open.
  const canExpand = Boolean(videoUrl);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);

  // Videos transcoded before thumbnails existed have none, so fall back to the plain background
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  useEffect(() => setThumbnailFailed(false), [thumbnailSrc]);

  // Show "Read more" only if the text really is cut off (re-checked on resize)
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el || !canExpand) {
      setTruncated(false);
      return undefined;
    }
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [description, canExpand]);

  // Play button and "Read more": run the play-video script on this card's video
  const handlePlay = () => {
    onPlay?.();
    if (videoUrl) {
      playVideo(videoUrl, {
        title,
        category,
        creator,
        publishedAt,
        publishedLabel,
        description,
      });
    }
  };

  return (
    <article
      className={`video-card ${className}`.trim()}
      aria-labelledby={titleId}
    >
      {/* Top: thumbnail */}
      <div className="video-card__thumbnail">
        {thumbnailSrc && !thumbnailFailed ? (
          <img
            className="video-card__image"
            src={thumbnailSrc}
            alt={thumbnailAlt}
            width={480}
            height={270}
            decoding="async"
            onError={() => setThumbnailFailed(true)}
          />
        ) : !videoUrl || isHlsUrl(videoUrl) ? (
          // The <video> frame trick doesn't work on an HLS playlist, so leave the plain background
          null
        ) : (
          // No thumbnail supplied: show a frame from the video itself
          <video
            className="video-card__image"
            src={`${videoUrl}#t=0.5`}
            preload="metadata"
            muted
            tabIndex={-1}
            aria-hidden="true"
            disablePictureInPicture // PIP Button Toggle
            disableRemotePlayback   // Remote Playback Toggle
            controlsList="nodownload noplaybackrate"
            style={{ pointerEvents: "none" }}
          />
        )}

        <div className="video-card__shade" aria-hidden="true" />

        <button
          className="video-card__play"
          type="button"
          onClick={handlePlay}
          disabled={!onPlay && !videoUrl}
          aria-label={`Play ${plainTitle}`}
        >
          <svg
            width="16"
            height="18"
            viewBox="0 0 16 18"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M1 1L15 9L1 17V1Z" fill="currentColor" />
          </svg>
        </button>

        {duration && (
          <span className="video-card__duration">
            <span className="video-card__sr-only">Video duration: </span>
            {duration}
          </span>
        )}
      </div>

      {/* Middle: title and metadata */}
      <header className="video-card__header">
        {category && <p className="video-card__category">{category}</p>}

        <h2 className="video-card__title" id={titleId}>
          {title}
        </h2>

        {(creator || dateText) && (
          <p className="video-card__metadata">
            {creator && <span>{creator}</span>}
            {creator && dateText && (
              <span className="video-card__separator" aria-hidden="true">
                ·
              </span>
            )}
            {dateText && <time dateTime={publishedAt}>{dateText}</time>}
          </p>
        )}
      </header>

      {/* Bottom: description (3 lines, then "Read more") */}
      {description && (
        <div className="video-card__description">
          <p className="video-card__description-label">Description</p>
          <p
            ref={descriptionRef}
            className="video-card__description-text"
            style={canExpand ? clampStyle : undefined}
          >
            {description}
          </p>

          {truncated && (
            // Wrapped in the same class as the description so it picks up its text format
            <p className="video-card__description-text">
              <button
                className="video-card__read-more"
                type="button"
                onClick={handlePlay}
                style={{
                  padding: 0,
                  border: 0,
                  background: "none",
                  color: "inherit",
                  font: "inherit",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Read More
              </button>
            </p>
          )}
        </div>
      )}
    </article>
  );
}