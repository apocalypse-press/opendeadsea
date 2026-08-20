export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "www.opendeadsea.org") {
    url.hostname = "opendeadsea.org";
    return Response.redirect(url.href, 301);
  }
  return context.next();
}
