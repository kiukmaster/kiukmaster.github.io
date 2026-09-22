/** 이 파일에서 블로그 이름, 프로필, 소개, 공개 주소를 수정하세요. */
export default {
  title: { ko: 'KiukMaster', en: 'KiukMaster' },
  description: { ko: '경험을 글로 적어보려 합니다.', en: 'A personal blog for thoughts, notes, and things learned.' },
  siteURL: '',
  author: {
    name: '유서준',
    nameEn: 'Ryu-SeoJun',
    role: { ko: '사이버보안전공 1학년', en: 'Freshman in CyberSecurity' },
    // Sophomore 2학년
    // Junior 3학년
    // Senior 4학년
    bio: { ko: '사이버 보안을 전공하는 학생입니다.', en: 'I am a student majoring in cybersecurity.' },
    // assets/images/profile.webp 등 사이트 루트 기준 경로. 빈 값이면 이니셜 표시.
    avatar: 'assets/images/profile.jpg',
    links: { github: 'https://github.com/kiukmaster', linkedin: 'https://www.linkedin.com/in/seojun-ryu-8b5177433/', discord: '', email: 'kiuk5282@naver.com' }
  },
  // 소개 페이지 본문. Markdown 사용. 샘플 소개는 넣지 않았습니다.
  about: { ko: '', en: '' },
  // 글에서 사용한 카테고리는 자동 추가됩니다. 미리 표시할 항목만 입력하세요.
  categories: [],
  pageSize: 8,
  defaultTheme: 'gray',
  // feed.xml을 직접 관리할 때만 true로 변경하세요. 자동 생성·갱신은 하지 않습니다.
  feedEnabled: false
};
