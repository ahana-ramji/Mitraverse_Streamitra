/**
 * hls-stats
 *
 * Plays an HLS stream (.m3u8) in a <video> element with hls.js and shows a live
 * network stats card: the quality being played, measured download speed, how many
 * seconds are buffered ahead, and a row per downloaded segment.
 *
 * After each segment, an ABR rule (see abr.ts) picks the next quality. A toggle on
 * the card switches between the rules while the video plays.
 * Web only (uses the DOM and Media Source Extensions).
 */
import type Hls from "hls.js";
import { ABR_RULES, type AbrRule } from "./abr";
import { maxRenditionIndex } from "./screen-quality";

/** The ABR rule selected when playback starts. */
const DEFAULT_RULE = "throughput";
/** How many recent segments to average the speed over. */
const WINDOW = 3;
/** Older segment rows are dropped so the table doesn't grow forever. */
const MAX_ROWS = 40;

const MUTED = "#b5b5b5";
const SLOW = "#ff8a80";
const SWITCH_BG = "rgba(255, 213, 79, 0.12)";
const ACCENT = "#7c6cf0";

export function isHlsUrl(url: string): boolean {
  return /\.m3u8($|[?#])/i.test(url);
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: Partial<CSSStyleDeclaration> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, css);
  if (text !== undefined) node.textContent = text;
  return node;
}

const mbps = (bps: number) => `${(bps / 1e6).toFixed(2)} Mbps`;

/** One "Label: value" reading in the top row. Returns the element to update. */
function reading(parent: HTMLElement, label: string): HTMLElement {
  const item = make("div", { minWidth: "120px" });
  const value = make("div", { fontSize: "18px", fontWeight: "600", marginTop: "2px" }, "–");
  item.append(
    make(
      "div",
      { fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED },
      label,
    ),
    value,
  );
  parent.append(item);
  return value;
}

function buildCard() {
  const card = make("div", {
    padding: "20px",
    borderRadius: "8px",
    background: "#181818",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontVariantNumeric: "tabular-nums",
  });

  // ABR rule toggle, filled with one button per rule by attachHlsWithStats
  const toggle = make("div", {
    display: "inline-flex",
    padding: "3px",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.08)",
  });
  const ruleInfo = make("div", { fontSize: "13px", color: MUTED, margin: "8px 0 16px" });

  const now = make("div", { display: "flex", flexWrap: "wrap", gap: "16px 32px" });
  const level = reading(now, "Playing");
  const speed = reading(now, "Measured speed");
  const buffer = reading(now, "Buffer ahead");
  const lastDownload = reading(now, "Last segment download time");
  const switches = reading(now, "Quality switches");
  const screen = reading(now, "Viewport / player / cap");

  const screenHelp = make(
    "p",
    {
      margin: "8px 0 0",
      fontSize: "12px",
      lineHeight: "1.4",
      color: MUTED,
    },
    "Viewport = visible browser area · Player = rendered video size · Cap = highest quality allowed by the display size.",
  );

  // Buffer bar, full at the amount hls.js tries to keep buffered
  const bar = make("div", {
    height: "4px",
    marginTop: "16px",
    borderRadius: "2px",
    background: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  });
  const barFill = make("div", { height: "100%", width: "0%", background: ACCENT });
  bar.append(barFill);

  const scroll = make("div", { marginTop: "16px", maxHeight: "240px", overflowY: "auto" });
  const table = make("table", { width: "100%", borderCollapse: "collapse", fontSize: "13px" });
  const head = make("tr");
  ["Segment", "Quality", "Size", "Download time", "Speed", "Rule", "Next quality"].forEach((h, i) =>
    head.append(
      make(
        "th",
        {
          textAlign: i === 0 ? "left" : "right",
          padding: "6px 8px",
          color: MUTED,
          fontWeight: "500",
          position: "sticky",
          top: "0",
          background: "#181818",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        },
        h,
      ),
    ),
  );
  const thead = make("thead");
  thead.append(head);
  const log = make("tbody");
  table.append(thead, log);
  scroll.append(table);

  card.append(toggle, ruleInfo, now, screenHelp, bar, scroll);
  return { card, toggle, ruleInfo, level, speed, buffer, lastDownload, switches, screen, barFill, log };
}

/**
 * Attaches hls.js to `video` and returns the stats card plus a cleanup function.
 * Returns null if this browser can't run hls.js (the caller can fall back to native playback).
 */
export async function attachHlsWithStats(
  video: HTMLVideoElement,
  url: string,
): Promise<{ card: HTMLElement; destroy: () => void } | null> {
  const { default: HlsClass } = await import("hls.js");
  if (!HlsClass.isSupported()) return null;

  const ui = buildCard();
  // hls.js sorts levels lowest bitrate first, so 0 = the lowest quality
  const hls: Hls = new HlsClass({ startLevel: 0 });
  const recentSpeeds: number[] = []; // bits per second
  let switchCount = 0;
  let screenMaxLevel = 0;
  let screenCapReady = false;
  let rule: AbrRule = ABR_RULES.find((r) => r.id === DEFAULT_RULE) ?? ABR_RULES[0];

  // Switching rule takes effect when the next segment finishes downloading
  const buttons = ABR_RULES.map((r) => {
    const button = make(
      "button",
      {
        padding: "6px 14px",
        border: "none",
        borderRadius: "4px",
        font: "inherit",
        fontSize: "13px",
        cursor: "pointer",
      },
      r.name,
    );
    button.type = "button";
    button.onclick = () => {
      rule = r;
      showRule();
    };
    ui.toggle.append(button);
    return button;
  });
  const showRule = () => {
    ABR_RULES.forEach((r, i) => {
      const active = r === rule;
      buttons[i].style.background = active ? ACCENT : "transparent";
      buttons[i].style.color = active ? "#fff" : MUTED;
      buttons[i].setAttribute("aria-pressed", String(active));
    });
    ui.ruleInfo.textContent = rule.description;
  };
  showRule();

  const label = (i: number) => `${hls.levels[i].height}p`;

  const bufferAhead = () => {
    const b = video.buffered;
    return b.length ? Math.max(0, b.end(b.length - 1) - video.currentTime) : 0;
  };

  const maxLevelForScreen = () => {
    if (hls.levels.length === 0) return 0;

    // Measure the actual player dimensions  
    const rect = video.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    // Use the visible display area. The video element can be taller than a
    // short viewport and extend below the fold, especially in split-screen.
    const playerWidth = Math.min(rect.width || viewportWidth, viewportWidth);
    const playerHeight = Math.min(
      rect.height || playerWidth * (9 / 16),
      viewportHeight,
    );

    // Use the display headroom policy from screen-quality.ts rather than
    // treating a high-DPI phone as a desktop-sized player.
    const highestAllowed = maxRenditionIndex(hls.levels, playerWidth, playerHeight);

    ui.screen.textContent =
      `Viewport ${Math.round(viewportWidth)}×${Math.round(viewportHeight)} · ` +
      `Player ${Math.round(playerWidth)}×${Math.round(playerHeight)} · ` +
      `Max ${hls.levels[highestAllowed]?.height ?? 0}p`;

    return highestAllowed;
  };

  /*
   Update the screen cap if the player size is reduced and cap the current level immediately. 
   If the player becomes larger, the existing throughput/buffer ABR logic decides when to upgrade. 
  */
  const updateScreenCap = () => {
    if (!screenCapReady) return;

    const nextScreenMaxLevel = maxLevelForScreen();
    screenMaxLevel = nextScreenMaxLevel;

    // A smaller player should downgrade on the next segment. A larger player
    // leaves the upgrade decision to the existing throughput/buffer rule.
    if (hls.loadLevel > screenMaxLevel) {
      hls.loadLevel = screenMaxLevel;
    }
  };

  /* 
  Calculate the initial screen cap when the HLS manifest is loaded. 
  */
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScreenCap);
  resizeObserver?.observe(video);
  document.addEventListener("fullscreenchange", updateScreenCap);
  window.addEventListener("resize", updateScreenCap);
  window.visualViewport?.addEventListener("resize", updateScreenCap);

  hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
    // Keep the first segment at the lowest rendition (startLevel: 0). Once it
    // finishes, FRAG_LOADED will choose the next level from measured speed and
    // buffer, then apply this screen-size cap.
    screenCapReady = true;
    screenMaxLevel = maxLevelForScreen();
    video.play().catch(() => {});
  });

  hls.on(HlsClass.Events.FRAG_LOADED, (_event, { frag }) => {
    if (frag.type !== "main") return;

    // 1. How long did this segment take to download?
    const { loading, total } = frag.stats; // ms timestamps, bytes
    const seconds = Math.max(loading.end - loading.start, 1) / 1000;
    const speed = (total * 8) / seconds;

    // 2. Keep the last few measurements so one fast/slow segment doesn't flip quality.
    recentSpeeds.push(speed);
    if (recentSpeeds.length > WINDOW) recentSpeeds.shift();
    const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;

    // 3. The rule picks the next quality.
    const requestedLevel = rule.choose({
      levels: hls.levels.map(({ bitrate, height }) => ({ bitrate, height })),
      speeds: recentSpeeds,
      bufferAhead: bufferAhead(),
    });
    const next = Math.min(requestedLevel, screenMaxLevel);
    hls.loadLevel = next; // takes effect from the next segment
    const switching = next !== frag.level;

    ui.speed.textContent = mbps(avgSpeed);
    ui.lastDownload.textContent = `${seconds.toFixed(2)} s`;
    // If a segment takes longer to download than it takes to play, the buffer is shrinking.
    const slow = seconds > frag.duration;
    ui.lastDownload.style.color = slow ? SLOW : "";

    const tr = make("tr", { background: switching ? SWITCH_BG : "" });
    const cell = (text: string, css: Partial<CSSStyleDeclaration> = {}) =>
      make(
        "td",
        {
          textAlign: "right",
          padding: "4px 8px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          ...css,
        },
        text,
      );
    tr.append(
      cell(`#${frag.sn}`, { textAlign: "left" }),
      cell(label(frag.level)),
      cell(`${(total / 1e6).toFixed(2)} MB`),
      cell(`${seconds.toFixed(2)} s`, slow ? { color: SLOW, fontWeight: "600" } : {}),
      cell(mbps(speed)),
      cell(rule.name, { color: MUTED }),
      cell(`${switching ? "→ " : ""}${label(next)}`),
    );
    ui.log.prepend(tr);
    while (ui.log.children.length > MAX_ROWS) ui.log.lastElementChild?.remove();
  });

  hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event, { level }) => {
    const { width, height, bitrate } = hls.levels[level];
    // The first LEVEL_SWITCHED is the starting quality, not a switch
    if (ui.level.textContent !== "–") switchCount++;
    ui.switches.textContent = String(switchCount);
    ui.level.textContent = `${height}p`;
    ui.level.title = `${width}×${height} · ${mbps(bitrate)}`;
  });

  hls.on(HlsClass.Events.ERROR, (_event, data) => {
    if (data.fatal) ui.level.textContent = `Error: ${data.details}`;
  });

  ui.switches.textContent = "0";

  const timer = setInterval(() => {
    const ahead = bufferAhead();
    ui.buffer.textContent = `${ahead.toFixed(1)} s`;
    ui.barFill.style.width = `${Math.min(100, (ahead / hls.config.maxBufferLength) * 100)}%`;
  }, 250);

  hls.loadSource(url);
  hls.attachMedia(video);

  return {
    card: ui.card,
    destroy: () => {
      clearInterval(timer);
      resizeObserver?.disconnect();
      document.removeEventListener("fullscreenchange", updateScreenCap);
      window.removeEventListener("resize", updateScreenCap);
      window.visualViewport?.removeEventListener("resize", updateScreenCap);
      hls.destroy();
    },
  };
}
