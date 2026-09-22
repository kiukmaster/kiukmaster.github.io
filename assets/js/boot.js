/* 스타일 로딩 전에 저장된 테마를 적용합니다. 외부 요청은 하지 않습니다. */
(() => {
  const root = new URL('../../', document.currentScript.src).pathname;
  try {
    const theme = localStorage.getItem(`blog:${root}:theme`);
    if (['light', 'gray', 'dark'].includes(theme)) document.documentElement.dataset.theme = theme;
    const lang = localStorage.getItem(`blog:${root}:lang`);
    if (['ko', 'en'].includes(lang)) document.documentElement.lang = lang;
  } catch { /* 저장소가 차단되어도 기본 테마로 표시합니다. */ }
})();
