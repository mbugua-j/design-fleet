const slides = Array.from(document.querySelectorAll('.slide'));
const stage = document.getElementById('stage');
const counter = document.getElementById('counter');

// The house line art, lifted from the Figma vector so both surfaces draw the same curve.
// Figma places it at (-903, -104) on every slide that carries it, rotated 0.344 degrees.
// Slide 01 uses the same vector resized, so it overrides the transform via data-art
// rather than carrying a second near-identical copy of the path.
const ART_HOME = 'translate(-903,-104) rotate(0.344)';
const LINE_ART_PATH = 'M 0 481.5 C 0 481.2 0 480.9 40.3 415.9 C 80.5 350.9 161 221.2 203.3 168.2 C 245.6 115.2 247.3 142.9 199.3 230.2 C 151.3 317.4 53.5 463.4 123.5 484.6 C 193.5 505.7 434.2 397.6 549.3 348.8 C 640.6 310.1 637.7 314 680.4 281.2 C 715.5 254.3 754.2 235.4 774.8 211.6 C 809.8 171.2 853.1 141.4 875.6 129.2 C 885.5 123.8 895.2 121.4 886.3 136.8 C 877.5 152.2 850.7 185.8 790.1 234.8 C 729.6 283.7 636.2 346.9 562.4 392 C 488.6 437.1 437.2 462.3 399.2 476.3 C 361.2 490.3 338.1 492.4 323.5 492.4 C 308.8 492.4 303.3 490.2 300 486.2 C 296.6 482.1 295.6 476.3 298.3 457.2 C 301.1 438 307.6 405.6 379.7 332.2 C 451.7 258.9 589 145.5 684 81.7 C 778.9 18 827.4 7.3 861.3 2.2 C 895.1 -2.9 913 -2.2 912.9 40.6 C 912.9 83.3 894.4 168.2 852 254.9 C 809.6 341.6 743.9 427.6 683.3 495.4 C 622.7 563.2 569.2 610.2 522.6 641.6 C 476.1 673.1 438.1 687.7 427.2 642.3 C 416.4 596.9 433.7 491.1 484.3 406.2 C 534.9 321.4 618.2 260.6 674.5 222.8 C 730.7 184.9 757.5 171.7 766.5 183.8 C 775.6 195.9 766.1 233.7 728.6 294.1 C 691 354.6 625.7 436.6 600 472.7 C 574.4 508.8 590.4 496.5 648.4 459.4 C 706.4 422.3 805.9 360.6 882.4 317.1 C 958.9 273.6 1009.4 250 1045.7 234.9 C 1082 219.9 1102.6 214.1 1107.8 221.5 C 1112.9 228.8 1102.1 249.4 1078.5 278.2 C 1024.5 344.2 975.6 389.4 971.9 402.4 C 969.6 410.8 1045.6 390.3 1127.9 367.8 C 1234.4 338.8 1278.4 355.3 1389.8 366 C 1464.9 373.3 1548.6 395 1633.2 405.5 C 1687.6 408.9 1718 406.8 1739 403.6 C 1749.6 402.2 1760 401.4 1770.7 400.6';

function addLineArt(slide) {
  // slides the design deliberately keeps clear: the harbour scene and the call graph
  if (slide.hasAttribute('data-noart')) return;
  if (slide.querySelector('.lineart')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lineart');
  svg.setAttribute('viewBox', '0 0 1920 1080');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('transform', slide.dataset.art || ART_HOME);
  path.setAttribute('d', LINE_ART_PATH);
  svg.appendChild(path);
  slide.insertBefore(svg, slide.firstChild);
}

// Blocks that ease in. Layout wrappers are transparent: their children animate instead,
// so a two-column split staggers as two columns rather than one slab.
const TOP_LEVEL = ':scope > .head, :scope > .rule, :scope > .mark, :scope > .closer,' +
  ' :scope > .closer-sub, :scope > .kicker,' +
  ' :scope > .hairline, :scope > .thanks, :scope > .flourish,' +
  ' :scope > .wordmark, :scope > .card, :scope > .lede, :scope > .lede-sub, :scope > .byline,' +
  ' :scope > .fleet-link,' +
  ' :scope > .harbour-title, :scope > .harbour-kicker, :scope > .tethers, :scope > .pop';
const WRAPPERS = '.split, .trio, .numbered';

function animTargets(slide) {
  const out = [];
  const push = el => { if (el && out.indexOf(el) === -1) out.push(el); };
  slide.querySelectorAll(TOP_LEVEL).forEach(push);
  const scan = root => {
    Array.from(root.children).forEach(ch => {
      if (ch.matches(WRAPPERS)) scan(ch); else push(ch);
    });
  };
  const body = slide.querySelector('.body');
  if (body) scan(body);
  slide.querySelectorAll(':scope > .trio').forEach(scan);
  return out;
}

slides.forEach(s => {
  addLineArt(s);
  animTargets(s).forEach(el => el.classList.add('anim'));
});

function playIn(slide) {
  const els = Array.from(slide.querySelectorAll('.anim'));
  els.forEach(el => { el.classList.remove('in'); el.style.transitionDelay = ''; });
  void slide.offsetWidth; // flush, so re-entering a slide replays the entrance
  els.forEach((el, i) => {
    el.style.transitionDelay = Math.min(i * 80, 700) + 'ms';
    el.classList.add('in');
  });
  countUp(slide);
}

// Figures count up from zero when their slide arrives. The token cancels an
// in-flight run, so navigating away and back cannot leave two loops fighting
// over the same element.
let countRun = 0;

function countUp(slide) {
  const figures = Array.from(slide.querySelectorAll('[data-count]'));
  const run = ++countRun;
  if (!figures.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const format = n => n.toLocaleString('en-US');
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  figures.forEach((el, i) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    if (reduce) { el.textContent = format(target); return; }
    const duration = 1100;
    const startAt = performance.now() + 260 + i * 90;
    el.textContent = format(0);
    const step = (now) => {
      if (run !== countRun) return;           // superseded by a later slide change
      if (now < startAt) { requestAnimationFrame(step); return; }
      const p = Math.min(1, (now - startAt) / duration);
      el.textContent = format(Math.round(target * easeOut(p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

let index = 0;

function clampIndex(n) {
  return Math.max(0, Math.min(slides.length - 1, n));
}

function show(n) {
  index = clampIndex(n);
  slides.forEach((s, i) => {
    s.classList.toggle('is-active', i === index);
    s.inert = i !== index;
    s.setAttribute('aria-hidden', String(i !== index));
  });
  playIn(slides[index]);
  counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
  if (location.hash !== '#' + (index + 1)) {
    history.replaceState(null, '', '#' + (index + 1));
  }
}

function fit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / 1920, vh / 1080);
  const x = Math.round((vw - 1920 * scale) / 2);
  const y = Math.round((vh - 1080 * scale) / 2);
  stage.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
}

function fromHash() {
  const n = parseInt(location.hash.slice(1), 10);
  return Number.isFinite(n) ? n - 1 : 0;
}

document.addEventListener('keydown', (e) => {
  const restart = e.key === 'r' || e.key === 'R';
  if (e.target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
  if (e.target.closest('a, button') && e.key !== 'Escape' && !restart) return;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      e.preventDefault();
      show(index + 1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      e.preventDefault();
      show(index - 1);
      break;
    case 'Home':
    case 'r':
    case 'R':
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      show(0);
      break;
    case 'End':
      e.preventDefault();
      show(slides.length - 1);
      break;
    case 'f':
    case 'F':
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      break;
    default:
      break;
  }
});

stage.addEventListener('click', (e) => {
  if (e.target.closest('a, button, input, select, textarea')) return;
  if (window.getSelection && String(window.getSelection()).length > 0) return;
  const rect = stage.getBoundingClientRect();
  show(e.clientX < rect.left + rect.width / 3 ? index - 1 : index + 1);
});

window.addEventListener('resize', fit);
window.addEventListener('hashchange', () => show(fromHash()));

fit();
show(fromHash());
