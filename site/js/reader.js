const DEFAULT_SRC = "/data/fragments/1QIsa-a-Isa40-3-5.json";

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function selectedIndex() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("token");
  if (raw == null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function render(fragment) {
  const line = document.getElementById("token-line");
  const viewers = document.getElementById("viewers");
  const meta = document.getElementById("reader-meta");
  const label = document.getElementById("reader-label");
  if (label) label.textContent = fragment.label;
  if (line) {
    const dir = fragment.script === "hebrew" || fragment.script === "aramaic" ? "rtl" : "ltr";
    line.dir = dir;
    line.lang = fragment.language === "aramaic" ? "arc" : "he";
    line.innerHTML = "";
    fragment.tokens.forEach((token) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "token";
      button.dataset.index = String(token.i);
      button.textContent = token.t;
      if (token.uncertain) button.classList.add("is-uncertain");
      button.setAttribute("aria-pressed", token.i === selectedIndex() ? "true" : "false");
      button.addEventListener("click", () => select(token, fragment));
      item.append(button);
      line.append(item);
    });
  }
  if (viewers) {
    viewers.innerHTML = "";
    (fragment.viewers || []).forEach((viewer) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = viewer.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = `<svg class="ico" data-i="external-link"></svg>${viewer.label}`;
      item.append(link);
      if (viewer.note) {
        const note = document.createElement("p");
        note.textContent = viewer.note;
        item.append(note);
      }
      viewers.append(item);
    });
  }
  if (meta) {
    meta.innerHTML = `
      <li><span class="k">Language</span><span>${fragment.language || fragment.script}</span></li>
      <li><span class="k">Script</span><span>${fragment.script}</span></li>
      <li><span class="k">Tokens</span><span>${fragment.tokens.length}</span></li>`;
  }
  const current = fragment.tokens.find((token) => token.i === selectedIndex()) || fragment.tokens[0];
  if (current) select(current, fragment, false);
  if (window.odsIcons) window.odsIcons.paint();
}

function select(token, fragment, push = true) {
  document.querySelectorAll(".token").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.index === String(token.i) ? "true" : "false");
  });
  const detail = document.getElementById("token-detail");
  if (detail) {
    const rec =
      window.odsLexicon && window.odsLexicon.resolve
        ? window.odsLexicon.resolve(token.lex || token.t, fragment.language)
        : null;
    const lemmaId = rec ? rec.id : token.lex || "";
    const lemmaHref = lemmaId ? "/lex/?q=" + encodeURIComponent(lemmaId) : "/lex/";
    const gloss = rec ? rec.gloss : "Not in the seeded lexicon yet.";
    const strongs = rec && rec.strongs && rec.strongs.length ? rec.strongs.join(", ") : "";
    detail.innerHTML = `
      <p class="page-kicker">Selected word</p>
      <p class="lex-head" lang="${fragment.language === "aramaic" ? "arc" : "he"}" dir="rtl">${esc(token.t)}</p>
      <ul class="meta-list">
        <li><span class="k">Lemma</span>${
          lemmaId
            ? `<a href="${lemmaHref}"><code>${esc(lemmaId)}</code></a>`
            : "<span>Unknown</span>"
        }</li>
        <li><span class="k">Gloss</span><span>${esc(gloss)}</span></li>
        ${strongs ? `<li><span class="k">Strong's</span><span>${esc(strongs)}</span></li>` : ""}
        <li><span class="k">Position</span><span>${token.i + 1} of ${fragment.tokens.length}</span></li>
      </ul>
      <div class="actions">
        <a class="btn btn-secondary" href="${lemmaHref}">Open lemma</a>
        <a class="btn btn-primary" href="/edit/?fragment=${encodeURIComponent(fragment.id)}&amp;token=${token.i}">
          <svg class="ico" data-i="square-pen"></svg>Suggest a reading
        </a>
      </div>`;
    if (window.odsIcons) window.odsIcons.paint();
  }
  if (push) {
    const url = new URL(location.href);
    url.searchParams.set("token", String(token.i));
    history.replaceState({}, "", url);
  }
}

async function boot() {
  const src = document.body.dataset.fragmentSrc || DEFAULT_SRC;
  try {
    if (window.odsLexicon) await window.odsLexicon.load();
    const response = await fetch(src);
    if (!response.ok) throw new Error("fragment");
    render(await response.json());
  } catch {
    const line = document.getElementById("token-line");
    if (line) {
      line.innerHTML = "<li>This sample line could not be loaded.</li>";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
