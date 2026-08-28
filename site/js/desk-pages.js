function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusOf() {
  return window.odsSession && window.odsSession.last ? window.odsSession.last : { user: null, capabilities: {} };
}

function queueItem(item) {
  const kind =
    item.kind === "proposal" ? "Translation suggestion" : item.kind === "reply" ? "Reply" : "Comment";
  const unread = item.unread ? `<span class="badge badge-info">New</span>` : "";
  const status =
    item.status && window.odsDesk
      ? `<span class="${window.odsDesk.badgeClass(item.status)}">${esc(window.odsDesk.statusLabel(item.status))}</span>`
      : unread;
  return `<li>
    <a href="${esc(item.href)}" data-queue-id="${esc(item.id)}">
      <h2>${esc(item.title)}</h2>
      <p>${esc(item.login || "")} · ${esc(when(item.at))} · ${esc(kind)}. ${esc(item.blurb || "")}</p>
      ${status}
    </a>
  </li>`;
}

function historyItem(row) {
  const href = row.href || "#";
  const source = row.source === "git" ? "Git" : "Site";
  return `<li>
    <a href="${esc(href)}"${row.source === "git" ? ' target="_blank" rel="noopener noreferrer"' : ""}>
      <h2>${esc(row.message || row.title || row.short || "Change")}</h2>
      <p>${esc(row.login || "")} · ${esc(when(row.at || row.created_at))} · ${source}${row.short ? ` · ${row.short}` : ""}</p>
    </a>
  </li>`;
}

function renderGuest(root) {
  root.innerHTML = `
    <div class="callout">
      <svg class="ico" data-i="log-in"></svg>
      <div>
        <p>Sign in with GitHub to suggest a better translation and follow its review.</p>
        <p><a class="btn btn-primary" href="/signin/?next=/account/">Continue with GitHub</a></p>
      </div>
    </div>`;
  if (window.odsIcons) window.odsIcons.paint();
}

function renderDesk(state) {
  const root = document.getElementById("desk-root");
  if (!root) return;
  const session = statusOf();
  const user = session.user;
  if (!user) {
    renderGuest(root);
    return;
  }
  const cap = session.capabilities || {};
  const names = (window.odsSession && window.odsSession.TIER_NAME) || {};
  const queue = window.odsDesk.queueFor(user);
  const unread = queue.filter((q) => q.unread).length;
  const mine = (state.proposals || []).filter((p) => p.author_user_id === user.id);
  const needsVote = cap.review
    ? (state.proposals || []).filter((p) => p.status === "open" || p.status === "ready")
    : [];
  const needsApprove = cap.maintain ? (state.proposals || []).filter((p) => p.status !== "approved" && p.status !== "withdrawn") : [];
  const git = (state.git || []).slice(0, 8);
  const events = (state.events || []).slice(0, 8);
  const history = git
    .map((g) => ({ ...g, at: g.at, title: g.message, source: "git" }))
    .concat(events.map((e) => ({ ...e, message: e.title, source: "site", at: e.created_at })))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 12);

  root.innerHTML = `
    <div class="stats">
      <div class="stat"><b>${esc(String(unread))}</b><span>New in your queue</span></div>
      <div class="stat"><b>${esc(names[user.tier] || "Contributor")}</b><span>Tier</span></div>
      <div class="stat"><b>${esc(String(user.reputation || 0))}</b><span>Reputation</span></div>
    </div>
    <p class="lede">${esc(user.login)}. Your translation suggestions and their review appear here.</p>
    <div class="desk-grid">
      <section>
        <h2>Your queue</h2>
        ${queue.length ? `<ul class="index">${queue.slice(0, 12).map(queueItem).join("")}</ul>` : `<p class="hint">Nothing here yet. Open a machine draft and choose Improve translation.</p>`}
        <p class="actions"><a class="btn btn-secondary" href="/review/">All suggestions</a><a class="btn btn-ghost" href="/catalog/?queue=ai">Machine drafts</a></p>
      </section>
      <section>
        <h2>Your proposals</h2>
        ${mine.length ? `<ul class="index">${mine.map((p) => queueItem({ id: p.id, kind: "proposal", title: p.mss_label, blurb: p.reason, at: p.created_at, login: p.author_login, href: "/proposal/?id=" + encodeURIComponent(p.id), status: p.status })).join("")}</ul>` : `<p class="hint">You have not suggested a translation yet. Open any machine draft and choose Improve translation.</p>`}
        ${needsVote.length && cap.review ? `<h2>Needs a vote</h2><ul class="index">${needsVote.map((p) => queueItem({ id: p.id, kind: "proposal", title: p.mss_label, blurb: p.reason, at: p.updated_at || p.created_at, login: p.author_login, href: "/proposal/?id=" + encodeURIComponent(p.id), status: p.status })).join("")}</ul>` : ""}
        ${needsApprove.length && cap.maintain ? `<h2>Editor approval</h2><ul class="index">${needsApprove.map((p) => queueItem({ id: p.id, kind: "proposal", title: p.mss_label, blurb: p.reason, at: p.updated_at || p.created_at, login: p.author_login, href: "/proposal/?id=" + encodeURIComponent(p.id), status: p.status })).join("")}</ul>` : ""}
      </section>
    </div>
    <section class="desk-history">
      <h2>Edition history</h2>
      <p class="hint">Git commits from the corpus repo, then the site's own comment and approval record.</p>
      ${history.length ? `<ul class="index">${history.map(historyItem).join("")}</ul>` : `<p class="hint">No history loaded yet.</p>`}
      <p class="actions"><a class="btn btn-secondary" href="/history/">Open the full history</a><a class="btn btn-ghost" href="https://github.com/apocalypse-press/opendeadsea/commits/main" target="_blank" rel="noopener noreferrer">GitHub log</a></p>
    </section>
    <div class="actions"><a class="btn btn-ghost" href="/auth/logout?next=/">Sign out</a></div>`;
  if (window.odsIcons) window.odsIcons.paint();
}

function renderReview(state) {
  const list = document.getElementById("review-list");
  const ledger = document.getElementById("review-ledger");
  if (!list) return;
  const session = statusOf();
  const items = window.odsDesk.queueFor(session.user);
  const open = (state.proposals || []).filter((p) => p.status !== "approved" && p.status !== "withdrawn");
  if (ledger) {
    ledger.textContent = `${open.length} open proposal${open.length === 1 ? "" : "s"} · ${items.length} item${items.length === 1 ? "" : "s"} in the signed-in queue`;
  }
  if (!items.length) {
    list.innerHTML = `<p class="hint">No translation suggestions have been submitted yet.</p>`;
    return;
  }
  list.innerHTML = `<ul class="index">${items.map(queueItem).join("")}</ul>`;
}

function renderProposal() {
  const root = document.getElementById("proposal-root");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id") || "p_sample_qol";
  const p = window.odsDesk.getProposal(id);
  const session = statusOf();
  const user = session.user;
  const cap = session.capabilities || {};
  if (!p) {
    root.innerHTML = `<p class="lede">That proposal is not on this desk. Open the review queue.</p><p><a class="btn btn-secondary" href="/review/">Review queue</a></p>`;
    return;
  }
  const yes = window.odsDesk.reviewerApprovals(p.votes);
  const comments = window.odsDesk.commentsFor("proposal", p.id);
  const voted = user && (p.votes || []).some((v) => v.voter_user_id === user.id);
  const mine = user && user.id === p.author_user_id;
  const voteBlock =
    cap.review && p.status !== "approved"
      ? `<div class="actions">
          <button class="btn btn-primary" type="button" data-vote="1"${voted ? " disabled" : ""}><svg class="ico" data-i="check"></svg>Approve this reading</button>
          <button class="btn btn-secondary" type="button" data-vote="-1"${voted ? " disabled" : ""}>Request changes</button>
        </div>
        <p class="hint">${voted ? "You have already voted." : "Peer reviewers vote here. Two approvals mark it ready for an editor."}</p>`
      : cap.review
        ? ""
        : `<p class="hint">You can read this record. Voting is for peer reviewers.</p>`;
  const approveBlock =
    cap.maintain && p.status !== "approved"
      ? `<div class="actions"><button class="btn btn-primary" type="button" data-approve="1"><svg class="ico" data-i="check"></svg>Record editor approval</button></div>
         <p class="hint">The highest tier records approval for the edition. GitHub merge still waits on the App.</p>`
      : "";
  const reply =
    cap.suggest
      ? `<form id="proposal-reply" class="composer">
          <div class="field">
            <label for="reply-body">${mine ? "Respond to reviewers" : "Comment on this proposal"}</label>
            <textarea id="reply-body" required maxlength="2000" minlength="12"></textarea>
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Post comment</button></div>
          <p class="hint" id="reply-status" role="status"></p>
        </form>`
      : `<p class="hint">Sign in to comment.</p>`;

  root.innerHTML = `
    <p class="page-kicker">Proposal</p>
    <h1>Suggested translation on ${esc(p.mss_label || p.mss_id)}</h1>
    <ul class="meta-list">
      <li><span class="k">Manuscript</span><a href="/m/${esc(p.mss_id)}/${p.line_ref ? `?line=${encodeURIComponent(p.line_ref)}` : ""}">${esc(p.mss_label || p.mss_id)}${p.line_ref ? " · " + esc(p.line_ref) : ""}</a></li>
      <li><span class="k">Author</span><span>${esc(p.author_login)}</span></li>
      <li><span class="k">Status</span><span class="${window.odsDesk.badgeClass(p.status)}">${esc(window.odsDesk.statusLabel(p.status))}</span></li>
      <li><span class="k">Votes</span><span>${yes} reviewer approval${yes === 1 ? "" : "s"}</span></li>
    </ul>
    <div class="diff">
      <div class="diff-pane">
        <h2>Current</h2>
        <p dir="auto">${esc(p.current_form || "(none)")}</p>
      </div>
      <div class="diff-pane">
        <h2>Proposed</h2>
        <p dir="auto">${esc(p.proposed_form)}</p>
      </div>
    </div>
    <h2>Reason</h2>
    <p>${esc(p.reason)}</p>
    ${voteBlock}
    ${approveBlock}
    <p class="hint" id="proposal-action-status" role="status"></p>
    <h2>Thread</h2>
    ${
      comments.length
        ? `<ol class="thread">${comments
            .map(
              (c) =>
                `<li><p class="thread-meta">${esc(c.author_login)} · ${esc(when(c.created_at))}</p><p>${esc(c.body)}</p></li>`,
            )
            .join("")}</ol>`
        : `<p class="hint">No comments yet.</p>`
    }
    ${reply}`;
  if (window.odsIcons) window.odsIcons.paint();

  root.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!user) return;
      const status = document.getElementById("proposal-action-status");
      btn.disabled = true;
      window.odsDesk
        .vote(user, p.id, Number(btn.getAttribute("data-vote")))
        .then(() => renderProposal())
        .catch((error) => {
          btn.disabled = false;
          if (status) status.textContent = error.message || "The review could not be saved. Please try again.";
        });
    });
  });
  const approveBtn = root.querySelector("[data-approve]");
  if (approveBtn) {
    approveBtn.addEventListener("click", () => {
      if (!user) return;
      const status = document.getElementById("proposal-action-status");
      approveBtn.disabled = true;
      window.odsDesk
        .approve(user, p.id)
        .then(() => renderProposal())
        .catch((error) => {
          approveBtn.disabled = false;
          if (status) status.textContent = error.message || "The approval could not be saved. Please try again.";
        });
    });
  }
  const form = document.getElementById("proposal-reply");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const box = document.getElementById("reply-body");
      const status = document.getElementById("reply-status");
      const text = box && box.value.trim();
      if (!text) {
        if (status) status.textContent = "Write a comment first.";
        return;
      }
      window.odsDesk
        .addComment(user, { target_type: "proposal", target_id: p.id, body: text })
        .then(() => renderProposal())
        .catch((error) => {
          if (status) status.textContent = error.message || "The comment could not be saved. Please try again.";
        });
    });
  }
}

function renderHistory(state) {
  const list = document.getElementById("history-list");
  const ledger = document.getElementById("history-ledger");
  if (!list) return;
  const git = state.git || [];
  const events = state.events || [];
  const rows = git
    .map((g) => ({ ...g, source: "git", at: g.at, title: g.message }))
    .concat(events.map((e) => ({ ...e, source: "site", at: e.created_at, message: e.title })))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  if (ledger) {
    ledger.textContent = `${git.length} git commit${git.length === 1 ? "" : "s"} · ${events.length} site event${events.length === 1 ? "" : "s"}`;
  }
  list.innerHTML = rows.length
    ? `<ul class="index">${rows.map(historyItem).join("")}</ul>`
    : `<p class="hint">No history loaded. GitHub may have rate-limited the public log.</p>`;
}

function bindPreview(root) {
  if (!root) return;
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-preview]");
    if (!btn || !window.odsSession) return;
    window.odsSession.setPreview(btn.getAttribute("data-preview"));
    location.reload();
  });
  root.addEventListener("click", (ev) => {
    const link = ev.target.closest("a[data-queue-id]");
    const session = statusOf();
    if (link && session.user) window.odsDesk.markRead(session.user, link.getAttribute("data-queue-id"));
  });
}

function bootDeskPages() {
  const page = document.body.dataset.page;
  if (!["account", "review", "proposal", "history"].includes(page)) return;
  const go = () => {
    window.odsDesk.load().then((state) => {
      if (page === "account") renderDesk(state);
      if (page === "review") renderReview(state);
      if (page === "proposal") renderProposal();
      if (page === "history") renderHistory(state);
    });
  };
  document.addEventListener("ods:session", go);
  bindPreview(document.getElementById("main"));
  if (window.odsSession && window.odsSession.last) go();
}

bootDeskPages();
