(() => {
  if (window.frameElement?.id !== 'blog-frame' && new URLSearchParams(location.search).get('view') !== 'page') return;
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = {{ .css.RelPermalink | jsonify | safeJS }};
  styles.integrity = {{ .css.Data.Integrity | jsonify | safeJS }};
  document.head.append(styles);
  document.addEventListener('DOMContentLoaded', () => {
    const profile = document.createElement('script');
    profile.src = {{ .js.RelPermalink | jsonify | safeJS }};
    profile.integrity = {{ .js.Data.Integrity | jsonify | safeJS }};
    document.head.append(profile);
  }, { once: true });
})();
