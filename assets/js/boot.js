(() => {
  const root = document.documentElement;
  const prefix = `blog:${root.dataset.storageRoot || '/'}:`;
  try {
    const language = localStorage.getItem(prefix + 'lang');
    if (['ko', 'en'].includes(language)) root.lang = language;
  } catch { /* 저장소가 차단돼도 기본 화면을 표시합니다. */ }
})();
