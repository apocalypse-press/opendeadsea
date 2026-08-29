(function (root) {
  "use strict";

  function normalize(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
      .toLowerCase()
      .replace(/[’'`]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function compact(value) {
    return normalize(value).replace(/\s/g, "");
  }

  function distance(a, b, ceiling) {
    a = normalize(a);
    b = normalize(b);
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
    if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        rowMin = Math.min(rowMin, current[j]);
      }
      if (rowMin > ceiling) return ceiling + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function fuzzyLimit(value) {
    const n = normalize(value).length;
    if (n >= 8) return 2;
    if (n >= 4) return 1;
    return 0;
  }

  function bookForms(book) {
    return [book.id, book.name].concat(book.aliases || []).map(normalize).filter(Boolean);
  }

  function scoreBook(query, book) {
    const q = normalize(query);
    const qc = compact(query);
    let best = 0;
    for (const form of bookForms(book)) {
      if (q === form || qc === compact(form)) best = Math.max(best, 100);
      else if (form.startsWith(q) && q.length >= 3) best = Math.max(best, 78);
      else {
        const limit = fuzzyLimit(q);
        const d = limit ? distance(q, form, limit) : limit + 1;
        if (d <= limit) best = Math.max(best, 70 - d * 8);
      }
    }
    return best;
  }

  function resolveBook(query, books) {
    return (books || [])
      .map((book) => ({ book, score: scoreBook(query, book) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score || a.book.name.localeCompare(b.book.name))[0] || null;
  }

  function parseReference(query, books) {
    const raw = String(query || "").trim();
    const match = raw.match(/^(.+?)[\s.:]+(\d+)(?::\d+(?:[-–]\d+)?)?\s*$/);
    if (!match) return null;
    const hit = resolveBook(match[1], books);
    if (!hit || hit.score < 60) return null;
    return { book: hit.book, chapter: Number(match[2]), score: hit.score };
  }

  function coverageFor(coverage, bookId, chapter) {
    return (coverage || []).filter((record) =>
      (record.books || []).some((book) => {
        if (normalize(book.book) !== normalize(bookId)) return false;
        if (chapter == null) return true;
        return (book.verses || []).some((range) => Number(String(range).match(/^(\d+):/)?.[1]) === chapter);
      })
    );
  }

  function chapterHref(manuscript, book, chapter) {
    if (!manuscript || !manuscript.chapter_count) return manuscript?.path || "/catalog/";
    const slug = manuscript.chapter_bare ? String(chapter) : `${String(book.id).toLowerCase()}-${chapter}`;
    return `/m/${encodeURIComponent(manuscript.id)}/${encodeURIComponent(slug)}/`;
  }

  function queueBlurb(queue, manuscript) {
    const state = queue?.manuscripts?.[manuscript.id]?.queue;
    if (state === "ai") return "Machine draft available; human review pending";
    if (state === "signoff") return "English human-checked";
    if (state === "edit") return "Translation needs editorial help";
    return "No English translation in the edition yet";
  }

  function manuscriptBlurb(manuscript, queue, extra) {
    const bits = [];
    if (extra) bits.push(extra);
    if (manuscript.search_summary) bits.push(manuscript.search_summary);
    if (manuscript.provenance) bits.push(manuscript.provenance);
    if (manuscript.languages?.length) bits.push(manuscript.languages.join(" / "));
    if (manuscript.line_count) bits.push(`${manuscript.line_count} lines`);
    bits.push(queueBlurb(queue, manuscript));
    return bits.join(" · ");
  }

  function manuscriptScore(query, manuscript) {
    const q = normalize(query);
    const qc = compact(query);
    const primary = [manuscript.id, manuscript.label, manuscript.name, manuscript.composition];
    const aliases = manuscript.aliases || [];
    const context = [manuscript.search_summary, manuscript.provenance, manuscript.site]
      .concat(manuscript.languages || [], manuscript.lang_keys || [], manuscript.script || "");
    let best = 0;
    for (const [weight, fields] of [[120, primary], [112, aliases], [58, context]]) {
      for (const raw of fields) {
        const field = normalize(raw);
        if (!field) continue;
        if (q === field || qc === compact(field)) best = Math.max(best, weight);
        else if (field.includes(q) && q.length >= 3) best = Math.max(best, weight - 20);
      }
    }
    const queryTokens = q.split(" ").filter(Boolean);
    const fieldTokens = normalize(primary.concat(aliases, context).filter(Boolean).join(" ")).split(" ");
    let tokenScore = 0;
    for (const token of queryTokens) {
      const limit = fuzzyLimit(token);
      if (fieldTokens.some((candidate) => candidate === token)) tokenScore += 28;
      else if (limit && fieldTokens.some((candidate) => distance(token, candidate, limit) <= limit)) tokenScore += 20;
    }
    if (queryTokens.length && tokenScore >= queryTokens.length * 20) best = Math.max(best, 50 + tokenScore);
    return best;
  }

  function bookResult(book, chapter, witnesses) {
    const label = chapter == null ? book.name : `${book.name} ${chapter}`;
    const href = chapter == null
      ? `/work/?book=${encodeURIComponent(book.id)}`
      : `/work/?book=${encodeURIComponent(book.id)}&view=chapter&ch=${chapter}`;
    const witnessText = witnesses.length
      ? `${witnesses.length} manuscript witness${witnesses.length === 1 ? "" : "es"} in this edition`
      : "No manuscript witness in this edition";
    return { href, title: label, blurb: witnessText, kind: chapter == null ? "Biblical work" : "Bible chapter" };
  }

  function search(query, data) {
    const metadata = data.metadata || { books: [] };
    const catalog = data.catalog || [];
    const coverage = data.coverage || [];
    const queue = data.queue || {};
    const byId = new Map(catalog.map((record) => [record.id, record]));
    const ref = parseReference(query, metadata.books);
    const results = [];
    let note = null;

    if (ref) {
      if (ref.chapter < 1 || ref.chapter > ref.book.chapters) {
        note = { tone: "warn", text: `${ref.book.name} has ${ref.book.chapters} chapters in this edition's Hebrew-Bible numbering.` };
        return { query, reference: ref, note, results: [bookResult(ref.book, null, coverageFor(coverage, ref.book.id))] };
      }
      const witnesses = coverageFor(coverage, ref.book.id, ref.chapter);
      results.push(bookResult(ref.book, ref.chapter, witnesses));
      if (witnesses.length) {
        note = {
          tone: "info",
          text: `${witnesses.length} manuscript witness${witnesses.length === 1 ? "" : "es"} in this edition preserve wording from ${ref.book.name} ${ref.chapter}. Coverage is fragmentary; a witness may preserve only part of the chapter.`,
        };
      } else {
        note = {
          tone: "warn",
          text: `No manuscript in this edition preserves ${ref.book.name} ${ref.chapter}. ${metadata.coverage_note || "The Dead Sea Scrolls are fragmentary and do not preserve every book or chapter of the Hebrew Bible."}`,
        };
      }
      for (const witness of witnesses) {
        const manuscript = byId.get(witness.scroll);
        if (!manuscript) continue;
        results.push({
          href: chapterHref(manuscript, ref.book, ref.chapter),
          title: `${manuscript.label || manuscript.id} · ${ref.book.name} ${ref.chapter}`,
          blurb: manuscriptBlurb(manuscript, queue, "Preserves wording from this chapter"),
          kind: "Manuscript witness",
        });
      }
      return { query, reference: ref, note, results };
    }

    const bookHit = resolveBook(query, metadata.books);
    if (bookHit && bookHit.score >= 70) {
      const witnesses = coverageFor(coverage, bookHit.book.id);
      results.push(bookResult(bookHit.book, null, witnesses));
      for (const witness of witnesses.slice(0, 12)) {
        const manuscript = byId.get(witness.scroll);
        if (!manuscript) continue;
        results.push({
          href: manuscript.path,
          title: `${manuscript.label || manuscript.id}${manuscript.name ? ` · ${manuscript.name}` : ""}`,
          blurb: manuscriptBlurb(manuscript, queue, `Preserves ${bookHit.book.name}`),
          kind: "Manuscript witness",
        });
      }
    }

    const existing = new Set(results.map((item) => item.href));
    catalog
      .map((manuscript) => ({ manuscript, score: manuscriptScore(query, manuscript) }))
      .filter((hit) => hit.score >= 50 && !existing.has(hit.manuscript.path))
      .sort((a, b) => b.score - a.score || String(a.manuscript.label).localeCompare(String(b.manuscript.label)))
      .slice(0, 20)
      .forEach(({ manuscript }) => {
        results.push({
          href: manuscript.path,
          title: `${manuscript.label || manuscript.id}${manuscript.name ? ` · ${manuscript.name}` : ""}`,
          blurb: manuscriptBlurb(manuscript, queue),
          kind: manuscript.biblical ? "Biblical manuscript" : "Manuscript",
        });
      });

    return { query, reference: null, note, results: results.slice(0, 24) };
  }

  root.odsSearch = { normalize, distance, resolveBook, parseReference, coverageFor, manuscriptScore, search };
})(typeof window !== "undefined" ? window : globalThis);
