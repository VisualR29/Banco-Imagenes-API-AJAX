import axios from "https://cdn.jsdelivr.net/npm/axios@1/+esm";
import { UNSPLASH_ACCESS_KEY } from "./config.js";

const API_BASE = "https://api.unsplash.com";
if (!UNSPLASH_ACCESS_KEY) {
    console.error("Falta Llave de acceso de Unplash en scripts/config.js");
}
const client = axios.create({
    baseURL: API_BASE,
    headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
    },
    timeout: 12000,
});

function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (s) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s])
    );
}
function truncate(str, n) {
    const s = String(str || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function formatNumber(n) {
    if (typeof n !== "number") return n;
    return new Intl.NumberFormat("es-MX").format(n);
}
function photoCard(p) {
    const author = p.user?.name ?? "Autor desconocido";
    const small = p.urls?.small || p.urls?.regular;
    const alt = p.alt_description || p.description || "Foto de Unsplash";
    const id = p.id;
    const profile = p.user?.links?.html || p.user?.portfolio_url || "#";

    return `
    <article class="photo-card">
      <a class="photo-card__thumb" href="photo.html?id=${id}" aria-label="Ver detalle de la foto">
        <img loading="lazy" src="${small}" alt="${escapeHtml(alt)}">
      </a>
      <div class="photo-card__body">
        <h3 class="photo-card__title">
          <a href="photo.html?id=${id}">${truncate(alt, 64)}</a>
        </h3>
        <p class="photo-card__meta">Por <a href="${profile}" target="_blank" rel="noopener">${escapeHtml(author)}</a></p>
      </div>
    </article>
  `;
}

const qInput = document.getElementById("q");
const form = document.getElementById("searchForm");
const gridSearch = document.getElementById("gridSearch");
const gridRandom = document.getElementById("gridRandom");
const searchMeta = document.getElementById("searchMeta");
const loadMoreBtn = document.getElementById("loadMoreSearch");
const reloadRandomBtn = document.getElementById("reloadRandom");

const state = { query: "", page: 1, perPage: 24, total: 0 };

async function searchPhotos({ append = false } = {}) {
    if (!state.query || !gridSearch) return;
    try {
        if (searchMeta) searchMeta.textContent = "Cargando resultados…";

        const { data } = await client.get("/search/photos", {
            params: {
                query: state.query,
                page: state.page,
                per_page: state.perPage,
                content_filter: "high",
            },
        });

        if (!append) gridSearch.innerHTML = "";

        state.total = data.total || 0;
        const cards = data.results.map(photoCard).join("");
        gridSearch.insertAdjacentHTML("beforeend", cards);

        const shown = gridSearch.children.length;
        if (searchMeta) {
            searchMeta.textContent = `Resultados para “${state.query}”: ${shown} de ${state.total}`;
        }
        if (loadMoreBtn) loadMoreBtn.hidden = shown >= state.total;
    } catch (err) {
        console.error(err);
        if (searchMeta) searchMeta.textContent = "Ocurrió un error al buscar. Intenta nuevamente.";
    }
}

async function loadRandom() {
    if (!gridRandom) return;
    try {
        gridRandom.innerHTML = "<p class='muted'>Cargando…</p>";
        const { data } = await client.get("/photos/random", {
            params: { count: 18, content_filter: "high" },
        });
        const items = Array.isArray(data) ? data : [data];
        gridRandom.innerHTML = items.map(photoCard).join("");
    } catch (err) {
        console.error(err);
        gridRandom.innerHTML = "<p class='muted'>No se pudieron cargar imágenes aleatorias.</p>";
    }
}

function initIndexPage() {
    if (!form && !gridRandom) return;

    form?.addEventListener("submit", (e) => {
        e.preventDefault();
        state.query = qInput?.value.trim() || "";
        state.page = 1;
        searchPhotos({ append: false });
    });

    loadMoreBtn?.addEventListener("click", () => {
        state.page += 1;
        searchPhotos({ append: true });
    });

    reloadRandomBtn?.addEventListener("click", loadRandom);

    if (gridRandom) loadRandom();

    const urlQ = new URLSearchParams(location.search).get("q");
    if (urlQ && qInput) {
        qInput.value = urlQ;
        state.query = urlQ;
        searchPhotos();
    }
}

const article = document.getElementById("photoArticle");
const statsBox = document.getElementById("photoStats");

async function loadStats(photoId) {
    if (!statsBox) return;
    try {
        const { data: stats } = await client.get(`/photos/${photoId}/statistics`);
        const views = stats.views?.total ?? 0;
        const downloads = stats.downloads?.total ?? 0;
        const likes = stats.likes?.total ?? "—";

        statsBox.innerHTML = `
      <div class="stat"><strong>Vistas totales</strong><span>${formatNumber(views)}</span></div>
      <div class="stat"><strong>Descargas totales</strong><span>${formatNumber(downloads)}</span></div>
      <div class="stat"><strong>Likes (histórico)</strong><span>${formatNumber(likes)}</span></div>
    `;
    } catch (err) {
        console.error(err);
        statsBox.innerHTML = "<p class='muted'>No se pudieron obtener las estadísticas.</p>";
    }
}

async function renderPhoto(id) {
    if (!article) return;
    try {
        article.innerHTML = "<p class='muted'>Cargando detalle…</p>";

        const { data: photo } = await client.get(`/photos/${id}`);

        const alt = photo.alt_description || photo.description || "Foto de Unsplash";
        const author = photo.user?.name ?? "Autor desconocido";
        const profile = photo.user?.links?.html || "#";
        const downloadLink = photo.links?.download || photo.links?.html;

        article.innerHTML = `
      <div class="hero">
        <img src="${photo.urls?.regular}" alt="${escapeHtml(alt)}">
      </div>

      <div class="info">
        <h1 class="title">${escapeHtml(alt)}</h1>
        <p class="by">Por <a href="${profile}" target="_blank" rel="noopener">${escapeHtml(author)}</a></p>
        <p class="muted">Resolución: ${photo.width} × ${photo.height} • Likes: ${photo.likes}</p>
        <div class="actions">
          <a class="btn btn--ghost" href="index.html?q=${encodeURIComponent((alt || "").split(" ")[0] || "")}">Buscar similares</a>
        </div>
      </div>
    `;

        await loadStats(id);
    } catch (err) {
        console.error(err);
        article.innerHTML = "<p class='muted'>No se pudo cargar la información de la foto.</p>";
    }
}

function initPhotoPage() {
    if (!article) return;
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
        article.innerHTML = "<p class='muted'>No se proporcionó un ID de foto.</p>";
        return;
    }
    renderPhoto(id);
}

initIndexPage();
initPhotoPage();
