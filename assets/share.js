(() => {
  const links = document.querySelectorAll('[data-share-x]');
  if (!links.length) return;

  // Resolve the page's own canonical path on the current host. This also keeps
  // on-chain gateways and subdirectory deployments shareable without hardcoding
  // the conventional site's origin or leaking preview/tracking parameters.
  const canonical = document.querySelector('link[rel="canonical"]');
  const article = new URL(canonical?.getAttribute('href') || location.href, location.href);
  article.search = '';
  article.hash = '';

  for (const link of links) {
    const title = link.dataset.shareTitle || document.title;
    const text = `${title}\n\n${article.href}\n\n#tapeout #tapekit #bem`;
    // Keep the whole draft in one text parameter so it survives X redirects.
    const intent = new URL('https://twitter.com/intent/tweet');
    intent.search = `?text=${encodeURIComponent(text)}`;
    link.href = intent.href;
    link.addEventListener('click', () => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'share', { method: 'X', content_type: 'article', item_id: article.href });
      }
    });
  }
})();
