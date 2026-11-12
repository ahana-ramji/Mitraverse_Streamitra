/** One card entry as it appears in the .json file. */
export type VideoCardData = {
  /** Optional stable key. Falls back to the array index. */
  id?: string;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  category?: string;
  title?: string;
  creator?: string;
  publishedAt?: string;
  publishedLabel?: string;
  duration?: string;
  description?: string;
  /** Optional link/URL handed back to onPlay when the card is played. */
  videoUrl?: string;
};

export type ParseResult = {
  cards: VideoCardData[];
  errors: string[];
};

const STRING_FIELDS = [
  "id",
  "thumbnailSrc",
  "thumbnailAlt",
  "category",
  "title",
  "creator",
  "publishedAt",
  "publishedLabel",
  "duration",
  "description",
  "videoUrl",
] as const;

/** "2026-09-12" -> "12 September 2026". Returns undefined if the date is invalid. */
function formatDate(iso: string): string | undefined {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Accepts the raw text of a .json file (or an already-parsed value) and returns
 * valid cards plus human-readable errors for anything skipped.
 *
 * Supported shapes:
 *   [ { ...card }, { ...card } ]
 *   { "cards": [ { ...card } ] }
 *   { ...singleCard }
 *
 * Any field left out falls back to VideoCard's own defaults.
 */
export function parseVideoCards(input: string | unknown): ParseResult {
  const errors: string[] = [];
  let raw: unknown = input;

  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (err) {
      return {
        cards: [],
        errors: [`Invalid JSON: ${(err as Error).message}`],
      };
    }
  }

  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && Array.isArray((raw as any).cards)) {
    list = (raw as any).cards;
  } else if (raw && typeof raw === "object") {
    list = [raw];
  } else {
    return {
      cards: [],
      errors: ["Expected an array of cards or an object with a \"cards\" array."],
    };
  }

  const cards: VideoCardData[] = [];

  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`Card ${i + 1}: expected an object.`);
      return;
    }

    const card: Record<string, string> = {};
    for (const key of STRING_FIELDS) {
      const value = (entry as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") {
        errors.push(`Card ${i + 1}: "${key}" must be a string (skipped).`);
        continue;
      }
      card[key] = value;
    }

    // Derive the human-readable date if only the ISO date was supplied.
    if (card.publishedAt && !card.publishedLabel) {
      const label = formatDate(card.publishedAt);
      if (label) card.publishedLabel = label;
      else errors.push(`Card ${i + 1}: "publishedAt" is not a valid date.`);
    }

    cards.push(card as VideoCardData);
  });

  return { cards, errors };
}