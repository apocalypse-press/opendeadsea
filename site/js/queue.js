(function (root) {
  const BUCKETS = [
    { key: "none", label: "No translation", badge: "badge" },
    { key: "ai", label: "Machine draft", badge: "badge badge-info" },
    { key: "signoff", label: "Human checked", badge: "badge badge-ok" },
    { key: "edit", label: "Needs help", badge: "badge badge-warn" },
  ];
  const byKey = {};
  BUCKETS.forEach((b) => {
    byKey[b.key] = b;
  });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function rec(key) {
    return byKey[key] || byKey.none;
  }

  function join(mss, payload) {
    const rows = (payload && payload.manuscripts) || {};
    const fallback = (payload && payload.default) || "none";
    (mss || []).forEach((m) => {
      const hit = rows[m.id];
      m.queue = (hit && hit.queue) || fallback;
      m.queue_source = (hit && hit.source) || "derived";
      m.translation_pack = (hit && hit.pack_id) || null;
    });
    return mss;
  }

  function load(mss) {
    return fetch("/data/translations/queue.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((payload) => join(mss, payload));
  }

  function badgeHTML(key) {
    const b = rec(key);
    return `<span class="${b.badge}">${esc(b.label)}</span>`;
  }

  function lede(key, translationCount) {
    if (key === "ai") {
      if (translationCount) {
        return `Machine draft on ${translationCount} lines. Help improve it`;
      }
      return "Machine draft. Help improve it";
    }
    if (key === "signoff") {
      return "Human checked translation";
    }
    if (key === "edit") {
      return "Machine draft needs help";
    }
    return "No translation in the edition yet";
  }

  function ensure() {
    return Promise.resolve(root.odsQueue);
  }

  root.odsQueue = { BUCKETS, rec, join, load, badgeHTML, lede, ensure };
})(window);
