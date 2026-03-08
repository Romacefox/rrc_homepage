# RRC 홈페이지 운영/배포 가이드

## 현재 구현
- 공지/게스트/회원/출석/회비/위험판정/대시보드
- 월 1일 12:00 자동 추첨(룰렛)
- 회원가입/로그인 + 사진첩 업로드/목록

## 최초 배포 순서
1. GitHub에 프로젝트 업로드
2. Netlify에서 저장소 Import
3. Supabase 프로젝트 생성
4. SQL Editor 실행
- `supabase/schema.sql`
- `supabase/policies.sql`
5. Netlify 환경변수 설정
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
6. `script.js` 상단 설정값 입력
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
7. Deploy

## 운영진 페이지
- 경로: 메인 페이지 하단 `운영진 관리`
- 비밀번호: `script.js`의 `ADMIN_PASSWORD`
- 가능한 작업: 공지/회원/출석/회비/위험/대시보드/룰렛 테스트

## 사진첩 운영
- 회원은 회원가입 후 로그인
- 로그인 상태에서 사진 업로드 가능
- 사진은 Supabase Storage `rrc-photos` 버킷 저장

## 보안 권장
- 운영진 비밀번호 하드코딩 방식은 임시
- 실운영은 Supabase Auth 기반 운영진 권한(roles)으로 전환 권장


## 배포 점검
- DEPLOY_CHECKLIST.md 순서대로 검수하세요.

