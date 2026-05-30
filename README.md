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
- RRC 포인트는 현금 지급 수단이 아니라, RRC 활동 참여를 기록하고 RRC샵 보조권 신청 및 챌린지 참여에 활용하는 활동 포인트입니다.
- RRC샵 보조권 기준은 `500P = 5,000원`, `1,000P = 10,000원`, `2,000P = 20,000원`이며, 보조권은 운영 예산과 운영진 승인 기준에 따라 처리됩니다.
- 월 참여상 후보 등극 20P, 2개월 연속 후보 30P, 3개월 이상 연속 후보 50P를 부여합니다.
- 매주 정기런 참여 30P, 화요일 한강 정기런 누적 10회 달성 50P, 목요일 올림픽공원 정기런 누적 10회 달성 50P를 부여합니다.
- 월 사진 최대 5장(장당 5P), 월 응원 댓글 최대 10개(개당 2P)를 부여합니다.
- 운영진은 낭만러너, 페이스메이커, 게스트메이트, 코스메이커, 대회후기왕, 운영헬퍼, 응원요정, 챌린지메이커, 번개왕 같은 월간 배지 포인트를 수동 지급할 수 있습니다.
- 포인트 챌린지는 참가 포인트를 예치하고, 카카오톡 채팅방 인증을 운영진이 판정한 뒤 성공자가 팟을 1/n로 나눠 받습니다. 정산 시 성공 포인트는 월간 포인트 지급 기록에 자동 반영됩니다.
- 포인트는 신청 기준 안내용이며, 실제 RRC샵 보조는 월 예산과 운영진 승인 후 진행합니다.

## 활동보드 미션 포인트
- `member_mission_claims`가 `member_id + mission_key + period_key` 유니크 키로 중복 지급을 막습니다.
- 미션 지급은 `/.netlify/functions/activity-missions`에서 승인 회원 JWT를 확인한 뒤 `claim_activity_mission` RPC로 처리합니다.
- 포인트 원장은 기존 `member_point_awards`를 재사용하며, 미션 지급 건은 `award_code = mission_<mission_key>` 형식으로 남습니다.
- 1회성 오픈 이벤트: 활동보드 첫 방문 20P, 내 출석 기록 확인 20P, 첫 사진 업로드 20P, 첫 댓글 작성 10P, 첫 챌린지 참여 50P.
- 월간 미션: 월 2회 정기런 참여 30P, 월 5회 이상 정기런 참여 50P. 월간 미션은 `YYYY-MM` 기준으로 다음 달에 다시 받을 수 있습니다.
- 오픈 이벤트 미션 포인트는 활동보드 적응을 위한 1회성 이벤트이며, 운영 상황에 따라 기준이 조정될 수 있습니다.

## 활동보드 미션 테스트
1. 승인 회원으로 로그인해 활동보드에 접속하면 상단에 `이번 달 내 미션` 카드가 보이는지 확인합니다.
2. 승인되지 않은 회원으로 로그인하거나 로그아웃하면 미션 정보와 포인트 받기 버튼이 보이지 않는지 확인합니다.
3. `활동보드 첫 방문`의 `포인트 받기`를 누른 뒤 새로고침해도 다시 지급되지 않는지 확인합니다.
4. 같은 미션의 `포인트 받기` 버튼을 여러 번 빠르게 눌러도 `member_mission_claims`와 `member_point_awards`에 1건만 남는지 확인합니다.
5. 이번 달 정기런 출석이 2회 미만이면 `월 2회 정기런 참여` 버튼이 비활성화되는지 확인합니다.
6. 이번 달 정기런 출석이 2회 이상이면 `월 2회 정기런 참여` 30P를 받을 수 있는지 확인합니다.
7. 이미 받은 월간 미션은 같은 달에 다시 받을 수 없는지 확인합니다.
8. 다음 달 테스트 데이터 또는 `period_key`가 바뀐 상태에서 월간 미션을 다시 받을 수 있는지 확인합니다.
9. 현재 포인트 320P/800P/1,300P/2,000P 이상 계정으로 다음 RRC샵 보조권까지 남은 포인트와 진행률이 정확한지 확인합니다.
10. 모바일 폭에서 미션 카드, 진행률 바, 버튼이 줄바꿈되며 깨지지 않는지 확인합니다.

## 운영 메모
- 승인된 회원만 사진 업로드 가능
- 룰렛 결과/기록은 메인에서 전체 공개
- 운영 체크 카드에서 회비 미납, 추첨 후보, 활동 리스크, 최근 출석 로그를 빠르게 확인
- 모바일에서는 토스 화면의 입금자 이름만 복사해 `이름 목록 납부 처리`로 회비 반영 가능
- 운영진(admin) 권한은 `OWNER_EMAIL`에 지정된 모임장 계정만 부여/해제
- 신규 가입 알림은 `APPROVAL_NOTIFY_WEBHOOK_URL`이 설정된 경우 자동 전송

