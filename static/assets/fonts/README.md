# Fonts

Self-hosted WOFF2 subsets downloaded from Google Fonts on 2026-11-06.

- IBM Plex Sans KR: 400 and 500, CSS family `KIUK Sans`.
- Noto Serif KR: 500, CSS family `KIUK Serif`.
- Original `unicode-range` declarations are preserved in `assets/css/fonts.css`. Browsers request only subsets needed by text displayed on the page, not every file in these folders.
- All font files use `font-display: swap`. No third-party font requests are needed at runtime.
- Each family includes its original SIL Open Font License in `OFL.txt`.

Sources:

- https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500&family=Noto+Serif+KR:wght@500&display=swap
- https://github.com/google/fonts/tree/main/ofl/ibmplexsanskr
- https://github.com/google/fonts/tree/main/ofl/notoserifkr
- https://developers.google.com/fonts/docs/css2
