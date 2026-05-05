# RRC 홈페이지 운영/배포 가이드

## 현재 구현
- 공지/게스트/회원/출석/회비/위험판정/대시보드
- 운영진 수동 추첨(룰렛)
- 회원가입(프로필 입력) + 운영진 승인제 + 사진첩 업로드
- 신규 가입 웹훅 알림(선택)

## 승인제 흐름
1. 회원이 `auth.html`에서 가입 신청(이름/출생연도/소개 포함)
2. `member_profiles.approval_status = pending` 저장
3. 가입 직후 `APPROVAL_NOTIFY_WEBHOOK_URL`이 있으면 운영진 알림 전송
4. 운영진 계정으로 로그인 후 승인/반려 처리
5. 승인된 회원만 사진 업로드 가능

## 보안 변경점
- 클라이언트 하드코딩 운영진 비밀번호 방식 제거
- 운영진 로그인은 Supabase Auth(이메일/비밀번호) 사용
- Netlify 함수는 `Authorization: Bearer <access_token>` 검증 후
  `member_profiles.role = 'admin'` + `approval_status = 'approved'` 조건일 때만 승인 API 허용
- 운영진 권한(admin) 부여/해제는 Netlify `OWNER_EMAIL`과 일치하는 모임장 계정만 가능
- Supabase 정책은 승인된 회원만 사진 업로드/삭제 가능하도록 제한
- 신규 가입 알림은 Netlify `APPROVAL_NOTIFY_WEBHOOK_URL` 웹훅으로 전송 가능

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
- `OWNER_EMAIL` (모임장 계정 이메일)
- `APPROVAL_NOTIFY_WEBHOOK_URL` (선택, Discord/Slack/웹훅 알림용)
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

## 추첨 데이터 동기화
- 운영진 로그인 후 메인의 `Supabase 동기화` 버튼을 누르면
  로컬 운영 데이터(`members/notices/guests`)를 Supabase 기준 데이터로 일괄 반영합니다.
- 참여 추첨은 운영진이 출석 마감 후 `추첨하기` 버튼으로 실행합니다.
- 특히 월말 마지막 운영이 끝난 직후에는 동기화 후 추첨을 진행해야 최신 출석이 반영됩니다.

## 포인트 운영 기준
- 권장 환산은 `10P = 100원`입니다.
- 출석 1회 10P, 월 기준 달성 20P, 2개월 연속 30P, 3개월 이상 연속 50P를 부여합니다.
- 월 사진 최대 5장(장당 5P), 월 응원 댓글 최대 10개(개당 2P), 추첨 당첨 10P를 부여합니다.
- 포인트는 신청 기준 안내용이며, 실제 RRC샵 보조는 월 예산과 운영진 승인 후 진행합니다.

## 운영 메모
- 승인된 회원만 사진 업로드 가능
- 룰렛 결과/기록은 메인에서 전체 공개
- 운영진(admin) 권한은 `OWNER_EMAIL`에 지정된 모임장 계정만 부여/해제
- 신규 가입 알림은 `APPROVAL_NOTIFY_WEBHOOK_URL`이 설정된 경우 자동 전송

