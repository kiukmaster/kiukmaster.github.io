(() => {
  const root = document.documentElement;
  const prefix = `blog:${root.dataset.storageRoot || '/'}:`;
  try {
    const theme = localStorage.getItem(prefix + 'theme');
    const language = localStorage.getItem(prefix + 'lang');
    if (['light', 'gray', 'dark'].includes(theme)) root.dataset.theme = theme;
    if (['ko', 'en'].includes(language)) root.lang = language;
  } catch { /* 저장소가 차단돼도 기본 화면을 표시합니다. */ }
})();
