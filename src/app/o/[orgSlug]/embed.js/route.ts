import { getBaseUrl } from "@/lib/env";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Loader script for the embeddable careers widget. An org pastes:
 *   <div data-eas-jobs></div>
 *   <script src="https://host/o/{slug}/embed.js" async></script>
 * on their own site; this injects a same-origin iframe pointing at /embed and
 * auto-resizes it via postMessage. Sandboxed iframe = safe on the host page.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) {
    return new Response("// organization not found", {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const embedUrl = `${getBaseUrl()}/o/${orgSlug}/embed`;
  const slugJson = JSON.stringify(orgSlug);

  const js = `(function () {
  var EMBED_URL = ${JSON.stringify(embedUrl)};
  var SLUG = ${slugJson};
  var target = document.querySelector('[data-eas-jobs]');
  if (!target) {
    target = document.createElement('div');
    (document.currentScript && document.currentScript.parentNode
      ? document.currentScript.parentNode
      : document.body).appendChild(target);
  }
  var iframe = document.createElement('iframe');
  iframe.src = EMBED_URL;
  iframe.title = 'Open roles';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('sandbox', 'allow-popups allow-scripts allow-top-navigation-by-user-activation');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.height = '300px';
  iframe.style.overflow = 'hidden';
  target.appendChild(iframe);

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (data && data.type === 'eas-embed-height' && data.slug === SLUG && typeof data.height === 'number') {
      iframe.style.height = data.height + 'px';
    }
  });
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
