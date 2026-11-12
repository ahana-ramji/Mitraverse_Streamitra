import { useCallback, useEffect, useId, useState } from "react";
import VideoCard from "./dashvidcard";
import {
  parseVideoCards,
  type ParseResult,
  type VideoCardData,
} from "./parseVideoCards";
import "@styles/dashvidcardgenerator.css";

export type DashVidCardGeneratorProps = {
  /** URL of a .json file to load on mount, e.g. "/data/videos.json". */
  src?: string;
  /** Already-parsed JSON (or raw JSON text). Overrides `src`. */
  data?: unknown;
  /** Show the "Choose a .json file" picker. Default: true. */
  allowUpload?: boolean;
  /** Called when a card's play button is pressed. */
  onPlay?: (card: VideoCardData, index: number) => void;
  className?: string;
};

const EMPTY: ParseResult = { cards: [], errors: [] };

export default function DashVidCardGenerator({
  src,
  data,
  allowUpload = true,
  onPlay,
  className = "",
}: DashVidCardGeneratorProps) {
  const inputId = useId();
  const [result, setResult] = useState<ParseResult>(EMPTY);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load from `data` prop
  useEffect(() => {
    if (data === undefined) return;
    setResult(parseVideoCards(data));
  }, [data]);

  // Load from `src` URL
  useEffect(() => {
    if (!src || data !== undefined) return;
    const controller = new AbortController();
    setLoading(true);

    fetch(src, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${src} (${res.status})`);
        return res.text();
      })
      .then((text) => {
        setFileName(src.split("/").pop() ?? src);
        setResult(parseVideoCards(text));
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setResult({ cards: [], errors: [err.message] });
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [src, data]);

  // Load from a user-picked file
  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setResult({ cards: [], errors: ["Please choose a .json file."] });
      return;
    }
    setFileName(file.name);
    setResult(parseVideoCards(await file.text()));
  }, []);

  return (
    <section
      className={`video-card-generator ${className}`.trim()}
      aria-label="Video card generator"
    >
      {allowUpload && (
        <div className="video-card-generator__toolbar">
          <label className="video-card-generator__file" htmlFor={inputId}>
            Choose a .json file
          </label>
          <input
            id={inputId}
            className="video-card-generator__input"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
          <p className="video-card-generator__status" role="status">
            {loading
              ? "Loading…"
              : fileName
                ? `${fileName}: ${result.cards.length} card${result.cards.length === 1 ? "" : "s"}`
                : "No file selected"}
          </p>
        </div>
      )}

      {result.errors.length > 0 && (
        <ul className="video-card-generator__errors" role="alert">
          {result.errors.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}

      {result.cards.length > 0 && (
        <div className="video-card-generator__grid">
          {result.cards.map(({ id, videoUrl, ...props }, i) => {
            const card = { id, videoUrl, ...props } as VideoCardData;
            return (
              <VideoCard
                key={id ?? i}
                {...props}
                onPlay={
                  onPlay || videoUrl
                    ? () => {
                        if (onPlay) onPlay(card, i);
                        else window.open(videoUrl, "_blank", "noopener");
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}