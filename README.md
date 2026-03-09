# RRC 홈페이지 운영/배포 가이드

## 현재 구현
- 공지/게스트/회원/출석/회비/위험판정/대시보드
- 월 1일 12:00 자동 추첨(룰렛)
- 회원가입(프로필 입력) + 운영진 승인제 + 사진첩 업로드

## 승인제 흐름
1. 회원이 `auth.html`에서 가입 신청(이름/출생연도/소개 포함)
2. `member_profiles.approval_status = pending` 저장
3. 운영진 계정으로 로그인 후 승인/반려 처리
4. 승인된 회원만 사진 업로드 가능

## 보안 변경점
- 클라이언트 하드코딩 운영진 비밀번호 방식 제거
- 운영진 로그인은 Supabase Auth(이메일/비밀번호) 사용
- Netlify 함수는 `Authorization: Bearer <access_token>` 검증 후
  `member_profiles.role = 'admin'` + `approval_status = 'approved'` 조건일 때만 승인 API 허용

## 최초 배포 순서
1. GitHub 업로드
2. Netlify Import
3. Supabase SQL 실행
- `supabase/schema.sql`
- `supabase/policies.sql`
4. Netlify 환경변수 설정
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
5. 프론트 설정
- `script.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `auth.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
6. Deploy

## 운영진 계정 권한 부여 (한 번만)
Supabase SQL Editor에서 아래 실행:

```sql
update public.member_profiles
set role = 'admin', approval_status = 'approved'
where email = '운영진이메일@example.com';
```

## 자동추첨 데이터 동기화 (신규)
- 운영진 로그인 후 메인의 `Supabase 동기화` 버튼을 누르면
  로컬 운영 데이터(`members/notices/guests`)를 Supabase 기준 데이터로 일괄 반영합니다.
- 월 자동추첨 함수(`monthly-draw`)는 Supabase `members`를 기준으로 동작하므로,
  정기적으로 동기화를 눌러주면 추첨 데이터 불일치를 줄일 수 있습니다.

- 회원은 로그인 시 누구나 사진 업로드 가능
- 룰렛 결과/기록은 메인에서 전체 공개
- 운영진(admin) 권한은 모임장(기존 admin)이 부여/해제

