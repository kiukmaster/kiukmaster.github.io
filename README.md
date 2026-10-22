# KIUK 블로그

Hugo로 글을 HTML로 빌드하고 GitHub Pages로 제공합니다. 프로젝트 npm 패키지와 PHP·Node 서버는 사용하지 않습니다.

```mermaid
flowchart LR
  A[글 폴더 생성] --> B[글·카테고리·이미지 작성]
  B --> C[로컬 미리보기]
  C --> D[공개 설정 후 GitHub Pages 게시]
```

## 글 작성 순서

### 1. 새 글 만들기

PowerShell에서 프로젝트 루트를 연 뒤 실행합니다. `my-note`는 원하는 폴더 이름으로 바꾸세요.

```powershell
& .\.tools\hugo\hugo.exe new content posts/my-note
```

`content/posts/my-note/index.md`가 생성됩니다. 한국 시각과 `draft: true`가 자동으로 들어갑니다. 이 작업 폴더에는 Hugo를 준비했으며 다른 PC에서는 아래 설치 안내를 따르세요.

### 2. 제목과 본문 작성하기

생성된 `index.md`를 편집합니다. 위쪽 두 `---` 사이가 글 정보인 **머리말**이고, 그 아래가 본문입니다. 아래 날짜는 예시이므로 **새 글에 자동 입력된 시각을 그대로 사용하는 것을 권장합니다.**

```markdown
---
title: "네트워크 실습"
date: "2026-10-22T19:30:00+09:00"
description: "실습에서 확인한 내용"
categories: ["학습"]
tags: ["네트워크"]
draft: true
---

## 실습 내용

본문을 작성합니다.

```

| 항목 | 작성 규칙 |
|---|---|
| `title` | 화면에 보이는 제목입니다. |
| `date` | 자동 입력된 작성 시각입니다. 바꿀 때도 따옴표·초·시간대를 유지하세요. `+09:00`은 한국 시간입니다. |
| `description` | 목록과 공유 미리보기의 요약입니다. 빈 문자열도 가능합니다. |
| `categories`, `tags` | 분류·태그 목록입니다. 없으면 `[]`입니다. |
| `draft` | `true`는 사이트에서 제외, `false`는 공개 대상입니다. |
| `url` | 필요할 때 공개 주소를 고정합니다. 예: `/posts/p3/`. |
| `params.searchText` | 선택 항목입니다. 본문 외에 검색할 단어를 추가합니다. |

### 3. 카테고리 지정하기

별도 폴더나 설정을 만들 필요가 없습니다. 글 위쪽 정보에 `categories: ["학습"]`을 적으면 빌드할 때 왼쪽 분류와 해당 분류의 글 목록이 자동으로 생깁니다. 같은 이름을 쓰는 글은 같은 카테고리에 모입니다.

| 원하는 분류 | 글에 적을 값 |
|---|---|
| 학습 | `categories: ["학습"]` |
| 활동 | `categories: ["활동"]` |
| 두 분류에 함께 표시 | `categories: ["학습", "활동"]` |
| 분류 없음 | `categories: []` |

공개 빌드에는 `draft: false`이며 게시 시각이 지난 글의 카테고리만 표시됩니다. 카테고리 이름을 바꾸려면 해당 글들의 값을 같은 이름으로 수정합니다.

### 4. 이미지 넣기

이미지를 글과 같은 폴더에 넣고 본문에서 파일 이름을 참조합니다.

```text
content/posts/my-note/
├─ index.md
└─ image.png
```

```markdown
![네트워크 구성도](image.png)
```

### 5. 미리 보고 공개하기

```powershell
& .\.tools\hugo\hugo.exe server --buildDrafts --disableLiveReload
```

브라우저에서 [로컬 미리보기](http://localhost:1313/)를 엽니다. 초안도 표시됩니다. 저장 후 브라우저를 새로고침하고, 서버는 `Ctrl+C`로 종료합니다. CSP가 inline 스크립트를 제한하므로 live reload는 끕니다.

| 상태 | 해야 할 일 |
|---|---|
| 작성 중 | `draft: true` 유지 |
| 공개 준비 | 내용을 확인하고 `draft: false`로 변경 |
| 실제 게시 | 최초 Pages 전환을 완료한 뒤 변경을 기본 브랜치에 반영. Actions 빌드·배포가 성공하면 사이트에 표시 |

- 글은 `index.md` 하나로 관리합니다. 목록 JSON이나 공유용 HTML은 자동 생성됩니다.
- 최신 시각의 글이 첫 카드에 표시됩니다. 같은 시각이면 URL 오름차순입니다. 날짜만 적거나 시간대를 빠뜨리면 공개 글 빌드가 실패하며 파일 위치를 안내합니다.
- 미래 시각의 글은 그 시각 이후 실행되는 빌드부터 공개됩니다. 정기 예약 빌드는 설정하지 않았습니다.
- `draft: true`는 사이트 노출만 제외합니다. 공개 저장소에 올린 원본은 볼 수 있으므로 비공개 원고는 `_private/` 또는 저장소 밖에 보관하세요.

### 폴더 이름

**p1, p2 같은 이름을 계속 사용할 필요가 없습니다.** `network-practice`, `pentestgpt-review`처럼 작성하셔도 됩니다. 영문 소문자·숫자·하이픈을 권장합니다.

| 구분 | 예시 |
|---|---|
| 글 파일 | `content/posts/network-practice/index.md` |
| 기본 공개 주소 | `/posts/network-practice/` |
| 화면 제목 | `title: "네트워크 실습"` |
| 예전 주소 유지 | `url: "/posts/p3/"`를 지정하면 폴더를 바꿔도 이 주소 유지 |

글 URL은 `/posts/` 아래에서 중복되지 않게 정합니다. `index.md` 파일명은 유지하세요. 기존 글은 p1/p2/p3의 주소를 명시해 보존했습니다.

### HTML과 이미지

표·접기·배치용 HTML/CSS를 Markdown 본문에 직접 넣을 수 있습니다.

```html
<details>
  <summary>실행 결과</summary>
  <p>확인한 내용을 작성합니다.</p>
</details>

<figure>
  <img src="image.png" alt="실행 결과 화면" width="800" height="450" loading="lazy">
  <figcaption>그림 설명</figcaption>
</figure>
```

- Markdown 이미지에는 글 폴더 안의 상대 경로를 사용하세요. JPG·PNG·WebP는 빌드 시 화면에 맞는 WebP 사본과 크기 정보가 생성됩니다. 원본을 덮어쓰지 않습니다.
- GIF·SVG와 직접 쓴 HTML 이미지는 자동 크기 변환을 하지 않습니다. HTML 이미지의 `width`·`height`는 원본 비율에 맞게 입력하세요.
- 직접 작성한 HTML을 허용하지만 HTML을 자동으로 안전하게 바꾸는 기능은 아닙니다. 신뢰하는 본문만 넣으세요. 글별 스크립트·이벤트 속성·외부 iframe은 지원 범위에서 제외하며 CSP가 차단합니다.

## Hugo 설치와 수동 빌드

사용 버전은 **Hugo 0.168.0 standard**입니다. Go·npm·Sass 설치는 필요하지 않습니다.

Windows 실행 파일은 [공식 릴리스](https://github.com/gohugoio/hugo/releases/tag/v0.168.0)의 `hugo_0.168.0_windows-amd64.zip`을 받아 `.tools/hugo/`에 압축 해제합니다. 이 작업 폴더에는 검증한 실행 파일을 준비했습니다. `.tools/`는 Git에 포함되지 않습니다.

공식 Windows ZIP SHA-256:

```text
f6cf760426de305cdd85c6eaa7e203a4d623e74cc6ad8fea61228caf1e59f243
```

PowerShell에서 저장소 루트 기준으로 실행합니다.

```powershell
# 공개 파일 생성: public/ 폴더
& .\.tools\hugo\hugo.exe build --minify --printPathWarnings --panicOnWarning
```

이 명령은 로컬 `public/` 폴더를 생성합니다. 실제 사이트 게시는 아래 GitHub Pages 전환·배포 절차를 따릅니다.

### GitHub 웹에서 작성

1. 저장소에서 **Add file → Create new file**을 선택합니다.
2. 이름을 `content/posts/my-note/index.md`로 입력하고 위 양식을 작성합니다.
3. 같은 폴더에 이미지를 업로드합니다.
4. 변경을 기본 브랜치에 반영하면 Actions가 빌드합니다. 아래의 최초 Pages 설정을 먼저 완료해야 합니다.

## 파일 구성

| 경로 | 수정할 내용 |
|---|---|
| `content/posts/` | 글과 글별 이미지 |
| `content/_index.md` | 이전 소개 주소를 홈으로 연결 |
| `hugo.toml` | 사이트 이름·프로필·연락처 |
| `static/assets/images/bluescreen.png` | 프로필 이미지. 표시용 작은 사본은 자동 생성 |
| `layouts/` | 공통 HTML·목록·글 템플릿 |
| `assets/css/style.css` | 화면 스타일 |
| `assets/js/` | 검색·보기·테마·읽기 보조 |
| `data/ui.json` | 한국어·영어 메뉴 문구 |
| `.github/workflows/pages.yml` | 빌드·배포·보안 확인 |
| `.codex-work/blog-rebuild/legacy/` | 이관 전 원본과 사용자 로컬 변경 보관. 로컬 전용이며 Git 제외 |

홈·글·목차·분류·인접 글은 정적 HTML입니다. 검색은 제목·요약·분류·태그·추가 검색어를 대상으로 합니다. 검색·정렬·더 보기를 사용하거나 검색 query 주소로 접속할 때만 `/index.json`을 요청합니다. 메뉴 언어 전환은 본문을 번역하지 않습니다.

소개 메뉴·페이지는 제거했고 홈에서 글 목록을 표시합니다. 왼쪽 프로필과 아이콘 링크는 유지합니다. 기존 `/about.html`은 [Hugo aliases](https://gohugo.io/content-management/urls/#aliases)로 홈으로 연결됩니다.

화면·템플릿·빈 상태에는 슬로건이나 장식용 한 줄 문구를 추가하지 않습니다.

## GitHub Pages 배포

Pages Source는 **GitHub Actions**입니다. 글을 작성한 뒤 `draft: false`로 바꾸고 `main`에 커밋·푸시하면 GitHub에서 Hugo 빌드와 Pages 배포를 자동으로 실행합니다. 로컬의 `public/` 폴더를 커밋할 필요는 없습니다.

```mermaid
flowchart LR
  A[글 작성·미리보기] --> B[draft: false]
  B --> C[git add·commit]
  C --> D[git push origin main]
  D --> E[보안 확인·빌드 성공]
  E --> F[Pages 배포 및 기존 주소 확인]
```

```powershell
git add content/posts/network-practice
git commit -m "Add network practice post"
git push origin main
```

글 폴더 이름에 맞게 `network-practice`를 바꿉니다. Hugo 명령은 새 글 양식 생성과 미리보기를 돕는 도구이며, 본문은 편집기에서 직접 수정합니다. GitHub 저장소의 Actions에서 빌드·배포 결과를 확인할 수 있습니다.

- 다른 저장소에 처음 설치한다면 Pages Source를 **GitHub Actions**로 지정한 뒤 소스를 올립니다.
- PR에서는 빌드만 수행합니다. 기본 브랜치의 push 또는 수동 실행에서 배포합니다.
- `public/` 산출물만 업로드합니다. `.codex-work/`, 원본 Markdown, 보관본, 실행 파일은 배포 대상이 아닙니다.
- 기존 주소 `/posts/p1/`, `/posts/p2/`, `/posts/p3/`, `/about.html`을 배포 후 확인합니다.
- 실패하면 기존 성공 배포를 유지합니다. 필요하면 `legacy/`를 루트로 하는 정적 artifact로 복구할 수 있습니다. 브랜치 배포로 되돌릴 때는 해당 브랜치에 기존 정적 구조가 있는지 먼저 확인하세요.

## 보안 유지

| 대상 | 적용 방식 |
|---|---|
| Hugo | 공식 버전과 SHA-256 고정. 버전을 올릴 때 checksum도 함께 갱신 |
| 배포 도구 | 공식 upload-artifact·deploy-pages 소스를 전체 commit SHA로 고정 |
| 배포 도구의 Node | 공식 Node 24.22.1 컨테이너를 SHA-256 digest로 고정하고 실행 버전 확인. 불일치 시 중단 |
| 권한 | 빌드는 저장소 읽기, 배포 job에만 Pages·OIDC 쓰기 |
| 브라우저 | CSP로 사이트 스크립트만 실행. 외부 스크립트·iframe·object 제한 |
| 의존성 | 프로젝트 npm 패키지·PHP 서버·Node 서버 없음 |

GitHub runner의 내장 Node가 보안 기준보다 낮아 첫 배포가 중단되었습니다. 현재는 저장소를 Git으로 가져오고, 배포 JavaScript를 패치된 공식 Node 컨테이너 안에서 실행합니다. runner 내부 파일은 변경하지 않습니다. 컨테이너 digest와 `.github/scripts/run-pages-action.cjs`의 버전 확인을 함께 유지하세요. Git checkout은 현재 공개 저장소를 기준으로 구성되어 있습니다.

버전 고정은 자동 업데이트를 뜻하지 않습니다. Hugo·Node 이미지·공식 배포 도구를 갱신할 때 공식 보안 공지, checksum·digest, 입력값과 실행 파일 경로를 함께 확인합니다. 적용 근거와 확인 내역은 로컬 `.codex-work/blog-rebuild/security.md`에 기록합니다.

[Hugo 보안 정책](https://gohugo.io/configuration/security/) · [Node.js 2026-10-21 보안 수정](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) · [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
