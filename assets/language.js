(() => {
  const supported = new Set(["zh-cn", "en"]);
  const saved = localStorage.getItem("blonskr-language");

  if (document.body.dataset.languageRouter === "true") {
    const browserLanguage = navigator.language.toLowerCase();
    const language = supported.has(saved) ? saved : browserLanguage.startsWith("zh") ? "zh-cn" : "en";
    const entry = document.querySelector(`[data-language-link="${language}"]`);
    if (entry) {
      const url = new URL(entry.href);
      url.hash = location.hash;
      location.replace(url.href);
    }
    return;
  }

  document.querySelectorAll("[data-language-link]").forEach((link) => {
    const language = link.dataset.languageLink;
    if (!supported.has(language)) return;
    const url = new URL(link.href);
    url.hash = location.hash;
    link.href = url.href;
    link.addEventListener("click", () => localStorage.setItem("blonskr-language", language));
  });
})();
