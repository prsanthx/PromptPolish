/** Shadow styles for the ChatGPT composer button. Inlined so the page cannot fetch an extension file. */
export const COMPOSER_CSS = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483646;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  color-scheme: light;
}
.stack {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  font-family: ui-sans-serif, "Segoe UI", sans-serif;
  color: #1c1915;
  font-size: 14px;
  line-height: 1.4;
}
.fab {
  position: absolute;
  left: 0;
  top: 0;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #0f5e56;
  color: #f7fffe;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 94, 86, 0.35);
  animation: pp-float 2.6s ease-in-out infinite;
}
.fab:hover { animation-play-state: paused; transform: translateY(-2px) scale(1.04); }
.fab:focus-visible { outline: 2px solid #f3d48a; outline-offset: 3px; }
.fab svg { display: block; margin: 0 auto; }
.star { transform-origin: 16px 16px; animation: pp-spin 5.5s linear infinite; }
.ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid rgba(243, 212, 138, 0.85);
  animation: pp-ring 2.6s ease-out infinite;
  pointer-events: none;
}
.spark {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #f3d48a;
  opacity: 0;
  pointer-events: none;
}
.fab.is-burst { animation: pp-pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }
.fab.is-burst .spark { animation: pp-spark 0.55s ease-out; }
.fab.is-burst .s1 { --x: -18px; --y: -16px; }
.fab.is-burst .s2 { --x: 16px; --y: -20px; }
.fab.is-burst .s3 { --x: 20px; --y: 8px; }
.panel {
  position: absolute;
  top: 52px;
  right: 0;
  width: 320px;
  max-height: min(440px, 70vh);
  overflow: auto;
  padding: 12px;
  border-radius: 16px;
  background: #fbf8f3;
  color: #1c1915;
  border: 1px solid #ddd4c6;
  box-shadow: 0 18px 50px rgba(28, 25, 21, 0.28);
  transform-origin: top right;
  animation: pp-panel 0.28s cubic-bezier(0.2, 0.9, 0.2, 1);
}
.stack.opens-up .panel {
  top: auto;
  bottom: 52px;
  transform-origin: bottom right;
}
.stack.align-start .panel { right: auto; left: 0; transform-origin: top left; }
.stack.opens-up.align-start .panel { transform-origin: bottom left; }
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.title { font-weight: 700; letter-spacing: -0.02em; }
.close, .rewrite, .insert, .keep, .level {
  font: inherit;
  cursor: pointer;
}
.close {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #5e574c;
}
.task, .status, .hint {
  margin: 8px 0 0;
  color: #5e574c;
  font-size: 12px;
}
.levels { display: grid; gap: 6px; margin-top: 10px; }
.level {
  display: grid;
  gap: 2px;
  text-align: left;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #1c1915;
}
.level[aria-checked="true"] {
  border-color: #0f5e56;
  background: #e5f2f0;
}
.level-name { font-weight: 700; font-size: 13px; }
.level-help { color: #5e574c; font-size: 12px; font-weight: 400; }
.rewrite, .insert, .keep {
  border-radius: 999px;
  padding: 8px 12px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #1c1915;
}
.rewrite, .row { margin-top: 10px; }
.primary {
  background: #0f5e56;
  border-color: #0f5e56;
  color: #f7fffe;
  font-weight: 700;
}
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.preview-block { margin-top: 12px; }
.label {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5e574c;
}
.preview {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #ddd4c6;
  background: #fff;
  font: 12px/1.45 ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
}
.markers { list-style: none; margin: 8px 0 0; padding: 0; }
.markers li { display: flex; gap: 8px; align-items: baseline; margin: 0 0 6px; font-size: 12px; }
.badge {
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.badge.assumption { color: #6d4a10; background: #f6e6c6; }
.badge.question { color: #1d3e66; background: #e3edf7; }
.shimmer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(243, 212, 138, 0.55) 48%, transparent 62%);
  background-size: 200% 100%;
}
.panel.is-rewriting .shimmer { animation: pp-sheen 0.7s ease-in-out; }
.toast {
  position: absolute;
  top: 50px;
  right: 0;
  width: max-content;
  max-width: 240px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 999px;
  background: #0f5e56;
  color: #f7fffe;
  font-size: 12px;
  box-shadow: 0 8px 20px rgba(15, 94, 86, 0.3);
  animation: pp-panel 0.25s ease-out;
}
@keyframes pp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes pp-spin { to { transform: rotate(360deg); } }
@keyframes pp-ring {
  0% { transform: scale(0.92); opacity: 0.8; }
  100% { transform: scale(1.25); opacity: 0; }
}
@keyframes pp-pop {
  0% { transform: scale(1); }
  40% { transform: scale(0.86); }
  100% { transform: scale(1); }
}
@keyframes pp-spark {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(0.4); }
}
@keyframes pp-panel {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pp-sheen {
  from { opacity: 1; background-position: 100% 0; }
  to { opacity: 0; background-position: 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fab, .star, .ring, .spark, .panel, .shimmer, .toast { animation: none; }
}
`;
