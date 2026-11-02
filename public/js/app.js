import { detectLang, setLang, lang } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const state = { gallery: null };

async function loadJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url);
  return r.json();
}

function renderMedia() {
  const g = state.gallery;
  if (!g) return;
  const l = lang();
  const heroPhoto = (g.hero && g.hero.src ? g.hero : g.photos.find((p) => p.src === g.hero)) || g.photos[0];
  const hero = $("#hero-img");
  if (heroPhoto) { hero.src = heroPhoto.src; hero.alt = heroPhoto.alt[l]; }
  const fill = (box, list) => {
    box.innerHTML = "";
    list.forEach((p, i) => {
      const fig = document.createElement("figure");
      const b = document.createElement("button");
      b.type = "button";
      b.title = p.alt[l];
      if (p.contain) b.classList.add("is-plan");
      const img = document.createElement("img");
      img.src = p.src;
      img.alt = p.alt[l];
      if (i > 0) img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", () => openLightbox(list, i));
      fig.appendChild(b);
      if (p.caption) {
        const cap = document.createElement("figcaption");
        cap.textContent = p.caption[l];
        fig.appendChild(cap);
      }
      box.appendChild(fig);
    });
  };
  fill($("#gallery"), g.photos);
  fill($("#gallery-area"), g.area || []);
  $("#gallery-area").classList.toggle("has-feature", (g.area || []).length === 5);
}

// Großansicht mit Blättern (Pfeiltasten, Buttons, Wischen)
const lightbox = { list: [], index: 0 };

function showLightboxImage() {
  const { list, index } = lightbox;
  const p = list[index];
  const l = lang();
  const img = $("#lightbox-img");
  img.src = p.src;
  img.alt = p.alt[l];
  img.classList.toggle("is-plan", !!p.contain);
  $("#lightbox-cap").textContent = p.alt[l];
  $("#lightbox-count").textContent = `${index + 1} / ${list.length}`;
  const single = list.length < 2;
  $("#lightbox-prev").hidden = single;
  $("#lightbox-next").hidden = single;
}

function stepLightbox(delta) {
  const n = lightbox.list.length;
  if (n < 2) return;
  lightbox.index = (lightbox.index + delta + n) % n;
  showLightboxImage();
}

function openLightbox(list, index) {
  lightbox.list = list;
  lightbox.index = index;
  showLightboxImage();
  $("#lightbox").showModal();
}

async function init() {
  await setLang(detectLang());
  try {
    state.gallery = await loadJson("images/gallery.json");
    renderMedia();
  } catch {
    // Ohne Galerie bleibt der Rest der Seite nutzbar.
  }

  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", async () => { await setLang(b.dataset.lang); renderMedia(); })
  );
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  $("#lightbox-prev").addEventListener("click", () => stepLightbox(-1));
  $("#lightbox-next").addEventListener("click", () => stepLightbox(1));
  $("#lightbox").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
  });
  let touchX = null;
  $("#lightbox").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $("#lightbox").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    touchX = null;
  });
}

init();
