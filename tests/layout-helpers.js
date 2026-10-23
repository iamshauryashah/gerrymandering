// Helpers for the layout tests: the real page is opened in a same-origin iframe of an exact size, so the page's media and
// container queries see that size as the window, and boxes can be measured against it.
import { generateState } from './fixtures.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lets the page's observers and the next frames run, so measured boxes are the settled ones.
export const settle = (ms = 80) => sleep(ms);

export async function openPage(width, height, seed) {
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;border:0;background:#fff`;
  frame.src = `../index.html?seed=${encodeURIComponent(seed)}`;
  document.body.append(frame);
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  for (let i = 0; i < 400 && !frame.contentWindow.gerryApp?.state; i += 1) await sleep(25);
  if (!frame.contentWindow.gerryApp?.state) throw new Error(`the page did not start at ${width} x ${height}`);
  await sleep(80);
  return frame;
}

export function closePage(frame) {
  frame.contentWindow.gerryApp?.destroy?.();
  frame.remove();
}

export const resizePage = async (frame, width, height) => {
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  await sleep(60);
};

export const pageWindow = (frame) => ({ width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight });

export function rect(frame, selector) {
  const node = frame.contentDocument.querySelector(selector);
  if (!node) throw new Error(`nothing matches ${selector}`);
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

export function insideWindow(r, frame, slack = 0.5) {
  const { width, height } = pageWindow(frame);
  return r.width > 0 && r.height > 0 && r.left >= -slack && r.top >= -slack && r.right <= width + slack && r.bottom <= height + slack;
}

// The map as drawn: its 800 x 600 picture is scaled to fit the element and centered in it.
export function drawnMap(frame) {
  const r = rect(frame, '[data-role="map"]');
  const scale = Math.min(r.width / 800, r.height / 600);
  return { width: 800 * scale, height: 600 * scale };
}

const seeds = new Map();
// A seed whose state has exactly `count` districts.
export function seedWithDistricts(count) {
  if (!seeds.has(count)) {
    for (let i = 0; i < 400; i += 1) {
      if (generateState({ seed: `layout-${i}` }).districtCount === count) {
        seeds.set(count, `layout-${i}`);
        break;
      }
    }
  }
  return seeds.get(count);
}

export const scrollTop = (frame) => frame.contentWindow.scrollY;
export const dispatch = (frame, selector, type) => frame.contentDocument.querySelector(selector).dispatchEvent(new frame.contentWindow.MouseEvent(type, { bubbles: true }));
