import { describe, expect, it } from "vitest";
import { maxRenditionIndex } from "./screen-quality";

// Define a set of HLS renditions for testing 
const levels = [
  { width: 640, height: 360 },
  { width: 854, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

// Test cases for a phone-sized player, a tablet-sized player, and a large player or fullscreen laptop
describe("maxRenditionIndex", () => {
  it("selects 360p for a phone-sized player", () => {
    const index = maxRenditionIndex(levels, 390, 219);
    expect(levels[index].height).toBe(360);
  });

  it("selects 720p for a tablet-sized player", () => {
    const index = maxRenditionIndex(levels, 768, 432);
    expect(levels[index].height).toBe(720);
  });

  it("selects 1080p for a large player or fullscreen laptop", () => {
    const index = maxRenditionIndex(levels, 1100, 619);
    expect(levels[index].height).toBe(1080);
  });

  // Test unordered rendition lists
  it("works even when the manifest levels are not ordered by height", () => {
    const unordered = [levels[2], levels[0], levels[3], levels[1]];
    const index = maxRenditionIndex(unordered, 768, 432);
    expect(unordered[index].height).toBe(720);
  });
});
