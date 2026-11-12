/**
 * abr
 *
 * Adaptive bitrate (ABR) rules: after each segment downloads, a rule picks the
 * quality for the next one. Each rule is a small pure function so they can be
 * swapped while a video plays and compared on the same stream.
 *
 *  - Throughput: follows the measured download speed.
 *  - Buffer (BBA): follows how many seconds are buffered, ignoring speed.
 */

export type AbrLevel = {
  /** Bits per second, from the playlist's BANDWIDTH. */
  bitrate: number;
  height: number;
};

export type AbrInput = {
  /** Qualities sorted lowest bitrate first, as hls.js gives them. */
  levels: AbrLevel[];
  /** Recent measured download speeds in bits per second, newest last. */
  speeds: number[];
  /** Seconds of video buffered ahead of the playhead. */
  bufferAhead: number;
};

export type AbrRule = {
  id: string;
  name: string;
  /** One line shown under the picker. */
  description: string;
  /** Returns the index of the level to download next. */
  choose(input: AbrInput): number;
};

/** Highest level whose bitrate is at most `rate`, or the lowest level if none fit. */
function highestUnder(levels: AbrLevel[], rate: number): number {
  let pick = 0;
  levels.forEach((level, i) => {
    if (level.bitrate <= rate) pick = i;
  });
  return pick;
}

/** Only pick a quality whose bitrate fits in this fraction of the measured speed. */
const SAFETY = 0.8;

const throughput: AbrRule = {
  id: "throughput",
  name: "Throughput",
  description: `Highest quality under ${SAFETY * 100}% of the average speed of the last few segments.`,
  choose({ levels, speeds }) {
    if (speeds.length === 0) return 0;
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return highestUnder(levels, avg * SAFETY);
  },
};

/** BBA: below RESERVOIR seconds always the lowest quality, above RESERVOIR + CUSHION the highest. */
const RESERVOIR = 5;
const CUSHION = 15;

const buffer: AbrRule = {
  id: "buffer",
  name: "Buffer (BBA)",
  description: `Lowest quality under ${RESERVOIR} s buffered, highest above ${RESERVOIR + CUSHION} s, in between it scales with the buffer.`,
  choose({ levels, bufferAhead }) {
    if (bufferAhead <= RESERVOIR) return 0;
    if (bufferAhead >= RESERVOIR + CUSHION) return levels.length - 1;
    // Map the buffer linearly onto the bitrate range (Huang et al., SIGCOMM 2014)
    const min = levels[0].bitrate;
    const max = levels[levels.length - 1].bitrate;
    const rate = min + ((bufferAhead - RESERVOIR) / CUSHION) * (max - min);
    return highestUnder(levels, rate);
  },
};

export const ABR_RULES: AbrRule[] = [throughput, buffer];
