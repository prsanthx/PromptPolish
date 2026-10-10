/** Shadow-DOM CSS for the ChatGPT launcher. Not injected into the page. */
export const PANEL_CSS = `
:host {
  position: fixed;
  z-index: 80;
  width: 0;
  height: 0;
  pointer-events: none;
}
:host([hidden]) { display: none; }
.launcher, .panel { pointer-events: auto; }
.launcher {
  position: absolute;
  top: 0;
  left: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: #0f5e56;
  color: #fbf8f3;
  box-shadow: 0 6px 16px rgba(28, 25, 21, 0.18);
  cursor: pointer;
  animation: pp-float 3.2s ease-in-out infinite;
}
.launcher .spark {
  transform-origin: 24px 23px;
  animation: pp-spark 2.6s ease-in-out infinite;
}
.launcher:hover {
  animation: none;
  transform: scale(1.08);
  box-shadow: 0 0 0 4px rgba(15, 94, 86, 0.2), 0 8px 18px rgba(28, 25, 21, 0.2);
}
.launcher:hover .spark { animation-duration: 1.1s; }
.launcher:active { transform: scale(0.92); }
.launcher:focus-visible {
  outline: 2px solid #0b3f3a;
  outline-offset: 3px;
}
:host(.is-open) .launcher { animation: none; }
.panel {
  position: fixed;
  box-sizing: border-box;
  width: 320px;
  max-height: var(--pp-max-h, 360px);
  overflow: auto;
  padding: 12px;
  border: 1px solid #ddd4c6;
  border-radius: 14px;
  background: #fbf8f3;
  color: #1c1915;
  box-shadow: 0 16px 40px rgba(28, 25, 21, 0.18);
  font: 13px/1.4 ui-sans-serif, "Segoe UI", sans-serif;
  transform-origin: bottom right;
  animation: pp-open 180ms cubic-bezier(.2, .8, .2, 1);
}
:host(.flip) .panel { transform-origin: top right; }
.panel h2 {
  margin: 0;
  font-size: 15px;
  letter-spacing: -0.02em;
}
.lede, .hint, .task {
  margin: 2px 0 0;
  color: #5e574c;
  font-size: 12px;
}
.levels {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
}
.level {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 7px 8px;
  border: 1px solid #ddd4c6;
  border-radius: 10px;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.level[aria-pressed="true"], .level:hover {
  border-color: #0f5e56;
  background: #e5f2f0;
}
.level:focus-visible { outline: 2px solid #0b3f3a; outline-offset: 2px; }
.level-name { font-weight: 700; }
.level-help { display: block; color: #5e574c; font-size: 12px; font-weight: 400; }
.working { margin-top: 10px; }
.working-bar {
  height: 3px;
  margin-top: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #0f5e56, transparent);
  background-size: 45% 100%;
  background-repeat: no-repeat;
  animation: pp-sweep 0.7s ease-in-out infinite;
}
label {
  display: block;
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 8px;
  border: 1px solid #ddd4c6;
  border-radius: 10px;
  background: #fff;
  color: inherit;
  font: 12px/1.45 ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  resize: vertical;
}
textarea:focus-visible { outline: 2px solid #0b3f3a; outline-offset: 1px; }
.markers {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.markers li {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 0 0 6px;
}
.badge {
  flex: none;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.badge.assumption { color: #6d4a10; background: #f6e6c6; }
.badge.question { color: #1d3e66; background: #e3edf7; }
.row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
button.action, button.ghost {
  font: inherit;
  font-size: 13px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: inherit;
  cursor: pointer;
}
button.action {
  background: #0f5e56;
  border-color: #0f5e56;
  color: #f7fffe;
  font-weight: 700;
}
button.action:focus-visible, button.ghost:focus-visible {
  outline: 2px solid #0b3f3a;
  outline-offset: 2px;
}
.notice {
  margin: 8px 0 0;
  font-size: 12px;
  color: #1c1915;
}
@keyframes pp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@keyframes pp-spark {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(16deg) scale(1.12); }
}
@keyframes pp-open {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes pp-sweep {
  0% { background-position: -40% 0; }
  100% { background-position: 140% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .launcher, .launcher .spark, .panel, .working-bar { animation: none; }
  .launcher:hover { transform: none; }
}
`;
