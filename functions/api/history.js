import { json } from "../_lib/http.js";
import { loadDesk, loadGithubHistory } from "../_lib/review.js";

export async function onRequestGet(context) {
  const git = await loadGithubHistory();
  const desk = await loadDesk(context.env);
  return json({
    git,
    events: desk.events,
    source: desk.source,
  });
}
