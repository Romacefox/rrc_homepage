# RRC 홈페이지 운영/배포 가이드

## 현재 구현
- 공지/게스트/회원/출석/위험판정/대시보드
- 운영진 수동 추첨(룰렛)
- 회원가입(프로필 입력) + 운영진 승인제
- 활동보드: 추첨, 포인트 랭킹, 챌린지, 건의함
- 신규 가입 웹훅 알림(선택)

## 승인제 흐름
1. 회원이 `signup.html`에서 가입 신청(이름/출생연도/소개 포함)
2. `member_profiles.approval_status = pending` 저장
3. 가입 직후 `APPROVAL_NOTIFY_WEBHOOK_URL`이 있으면 운영진 알림 전송
4. 운영진 계정으로 로그인 후 승인/반려 처리
5. 승인된 회원만 활동보드 기능 사용 가능

## 회원가입/승인 점검
- 가입 폼은 이메일 형식, 비밀번호 6자 이상, 비밀번호 확인, 실명 2자 이상, 출생연도 1989~2004, 자기소개 10자 이상, 개인정보 동의를 검사합니다.
- `/.netlify/functions/create-pending-profile`은 로그인 세션 JWT를 확인한 뒤 현재 Auth 사용자 기준으로만 `member_profiles` pending row를 생성합니다.
- 이메일 인증이 필요한 프로젝트에서는 가입 직후 세션이 없을 수 있으므로, 사용자가 이메일 인증 후 로그인하면 브라우저에 보관된 pending 정보 또는 Auth metadata로 프로필 생성을 재시도합니다.
- 운영진 화면의 `가입 상태 점검` 도구는 이메일/이름으로 Supabase Auth 사용자와 `member_profiles`를 함께 조회합니다.
- Auth 사용자는 있지만 프로필이 누락된 경우 운영진이 `pending 프로필 복구`로 승인 대기 프로필을 복구할 수 있습니다.
- 승인 처리 시 기존 `member-approval` 함수가 신규 가입 20P(`award_code = signup_bonus`)를 한 번만 지급하고 누락분도 보정합니다.

### 회원가입/승인 테스트
1. 필수 입력값, 비밀번호 불일치, 자기소개 10자 미만 상태에서 가입 신청이 막히는지 확인합니다.
2. 이미 가입된 이메일로 가입 시 한국어 오류 문구가 표시되는지 확인합니다.
3. 가입 버튼을 여러 번 눌러도 중복 요청이 발생하지 않도록 버튼이 비활성화되는지 확인합니다.
4. 이메일 인증이 필요한 경우, 인증 전에는 로그인 상태 안내가 `이메일 인증 필요`로 보이는지 확인합니다.
5. 인증 후 로그인하면 `member_profiles`에 본인 `user_id` 기준 pending 프로필이 생성되는지 확인합니다.
6. 승인 전 회원은 활동보드/포인트/챌린지 기능을 사용할 수 없는지 확인합니다.
7. 운영진으로 로그인해 승인 목록에서 pending 가입자가 보이는지 확인합니다.
8. 같은 회원을 빠르게 여러 번 승인해도 가입 보너스 20P가 한 번만 지급되는지 확인합니다.
9. 운영진 `가입 상태 점검`에서 이메일/이름 검색 결과가 Auth/프로필 상태를 함께 보여주는지 확인합니다.
10. Auth에는 있으나 프로필이 없는 테스트 계정을 `pending 프로필 복구`로 복구한 뒤 승인 목록에 표시되는지 확인합니다.

## 보안 변경점
- 클라이언트 하드코딩 운영진 비밀번호 방식 제거
- 운영진 로그인은 Supabase Auth(이메일/비밀번호) 사용
- Netlify 함수는 `Authorization: Bearer <access_token>` 검증 후
  `member_profiles.role = 'admin'` + `approval_status = 'approved'` 조건일 때만 승인 API 허용
- 운영진 권한(admin) 부여/해제는 Netlify `OWNER_EMAIL`과 일치하는 모임장 계정만 가능
- Supabase 정책은 승인된 회원만 활동보드 기능을 사용할 수 있도록 제한
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
- RRC 포인트는 현금 지급 수단이 아니라, RRC 활동 참여를 기록하고 활동 혜택 신청 및 챌린지 참여에 활용하는 활동 포인트입니다.
- 활동 혜택 기준은 `500P = 5,000원권`, `1,000P = 10,000원권`, `2,000P = 20,000원권`이며, 실제 제공은 월 예산과 운영진 승인 기준에 따라 처리됩니다.
- 가입 승인 시 웰컴 포인트 20P를 지급합니다.
- 월 4회 이상 출석해 추첨 후보 기준을 달성하면 월 1회 30P를 부여합니다.
- 추첨 후보 2개월 연속 달성 30P, 3개월 이상 연속 달성 50P를 부여합니다.
- 화요일 한강 정기런 또는 목요일 올림픽공원 정기런 누적 10회 달성 월에는 한강러버/올공러버 50P를 부여합니다.
- 운영진은 낭만러너, 페이스메이커, 운영헬퍼, 챌린지메이커, 이달의 러너, 이달의 번개왕, 등산킹 같은 핵심 배지 포인트만 수동 지급합니다.
- 사진 업로드/댓글 포인트는 운영 단순화를 위해 사용하지 않습니다.
- 챌린지는 무료 참여형과 포인트 예치형을 기본으로 운영하며, 성공 보상은 월간 포인트 지급 기록에 자동 반영됩니다.

## 활동보드 핵심 기능 테스트
1. 승인 회원으로 로그인하면 요약, 출석, 추첨, 포인트, 챌린지, 건의함 탭이 정상 표시되는지 확인합니다.
2. 월 4회 이상 참여자가 추첨 후보로 자동 집계되고, 후보가 없을 때는 근접 참여자가 안내되는지 확인합니다.
3. 포인트 탭에서 월간/연간 랭킹, 내 포인트 지급 기록, 활동 혜택 신청 상태가 정상 표시되는지 확인합니다.
4. 챌린지 탭에서 모집 중인 챌린지 참여, 진행 상태 변경, 성공/실패 판정, 정산 흐름이 정상 동작하는지 확인합니다.
5. 모바일 폭에서 빠른 이동 버튼, 탭, 추첨 대기실, 포인트 랭킹, 챌린지 목록이 줄바꿈되며 깨지지 않는지 확인합니다.

## 출석 입력 안정화 진단
- 현재 출석 입력 UI는 `index.html`의 운영 관리 영역에 있으며, 단건 입력은 `attendance-name`/`attendance-add`, 명단 입력은 `bulk-attendance-*`, 회원별 확인은 `attendance-check-*` 요소를 사용합니다.
- 기존 프론트 로직은 `script.js`의 `handleAttendanceByName`, `handleBulkAttendanceApply`, `renderAttendanceCheck`, `renderAttendanceLogs` 주변에 있습니다.
- 기존 서버 저장 로직은 `netlify/functions/admin-write.mjs`의 `append_attendance_member`, `apply_attendance`, `replace_attendance_log`, `revert_attendance_log`, `adjust_member_attendance` 분기에 있습니다.
- DB는 개별 출석 row가 아니라 `attendance_logs` 한 row에 `matched/unmatched/ambiguous` JSON 명단을 저장하고, `members.monthly_runs`와 `members.total_runs`를 함께 갱신하는 구조입니다.
- 활동보드, 출석 보너스, 추첨 후보 계산은 `attendance_logs.matched`와 `members.monthly_runs`를 함께 참고합니다.
- 기존 명단 전체 반영은 같은 날짜/유형의 기존 로그를 교체하는 흐름이라, 운영진 실수 시 기존 출석이 사라질 위험이 있었습니다.
- 운영진 권한 검증은 프론트에도 있었지만, 실제 저장은 Netlify Function에서 JWT와 `member_profiles.role = admin`, `approval_status = approved`를 다시 확인합니다.

## 출석 입력 안정화 변경
- 새 Netlify Function `/.netlify/functions/admin-attendance`를 추가했습니다.
- `preview`는 날짜/유형/모드/명단을 서버에서 검증하고 `will_add`, `already_attended`, `duplicate_input`, `ambiguous_name`, `not_found`, `not_approved`, `inactive`, `will_remove`, `unchanged` 상태를 반환합니다.
- `commit`은 preview 로직을 서버에서 다시 실행한 뒤 저장합니다. 프론트가 보낸 member id나 카운트를 신뢰하지 않습니다.
- 기본 모드는 `append`입니다. 기존 출석은 유지하고 아직 없는 회원만 추가합니다.
- `replace` 모드는 고급/위험 모드로 분리했고, 체크박스와 확인 문구 `교체합니다`가 있어야 실행됩니다.
- 저장 후 `operation_logs`에 `attendance_preview`, `attendance_append`, `attendance_replace` 작업 메타데이터를 기록합니다.
- 현재 aggregate 구조에 맞춰 `attendance_logs(attendance_date, event_type)` 유니크 인덱스를 추가했습니다. 배포 전 같은 날짜/유형 중복 로그가 있으면 먼저 병합/정리해야 합니다.
- 운영진 화면의 `구글시트 출석 가져오기`는 Google Sheets CSV를 날짜/유형별 묶음으로 읽고, 기존 `admin-attendance` 미리보기/반영 절차를 그대로 사용합니다.
- 시트 열은 `Date`, `Name`, `Category`를 권장합니다. 날짜 열 제목이 비어 있어도 첫 번째 열을 날짜로 읽습니다.
- 비공개 시트는 `Date`, `Name`, `Category` 열 범위를 그대로 복사해 `시트 내용 붙여넣기`에 넣으면 됩니다. Google Sheets 복사값처럼 탭으로 구분된 내용도 읽습니다.
- 지원 출석 유형은 `정기런`, `번개런`, `공식 행사`, `등산`, `소모임`입니다.
- 비공개 Google Sheet URL은 바로 읽을 수 없습니다. URL 방식은 `파일 > 공유 > 웹에 게시`로 CSV를 게시하거나, 추후 Google 서비스 계정 연동을 별도로 설정해야 합니다.

### 출석 DB 변경
- `attendance_logs_unique_scope`: `attendance_logs(attendance_date, event_type)` unique index

### 출석 입력 테스트
1. 운영진이 날짜/유형/명단을 입력하고 미리보기를 볼 수 있는지 확인합니다.
2. 일반 회원 토큰으로 `admin-attendance`를 호출하면 거절되는지 확인합니다.
3. append 모드에서 기존 출석은 유지되는지 확인합니다.
4. append 모드에서 이미 출석한 회원은 중복 저장되지 않는지 확인합니다.
5. replace 모드에서 제거 예정 회원이 미리보기에 표시되는지 확인합니다.
6. replace 모드는 체크박스와 `교체합니다` 입력 없이 실행되지 않는지 확인합니다.
7. 동명이인은 자동 저장되지 않고 `동명이인 확인`으로 표시되는지 확인합니다.
8. 회원 목록에 없는 이름은 자동 저장되지 않는지 확인합니다.
9. 승인 전 회원 또는 휴면 회원은 경고로 표시되는지 확인합니다.
10. 저장 후 활동보드의 이번 달 출석 횟수와 추첨 후보 계산이 갱신되는지 확인합니다.
11. 같은 명단을 두 번 저장해도 중복 출석이 생기지 않는지 확인합니다.
12. 출석 입력 내역이 `operation_logs`에 남는지 확인합니다.
13. 모바일 화면에서 미리보기 표가 한 줄 카드처럼 줄바꿈되어 읽히는지 확인합니다.
14. Google Sheets CSV 주소를 넣고 `시트 불러오기`를 누르면 월 기준으로 날짜/유형별 묶음이 생성되는지 확인합니다.
15. Google Sheets에서 열 범위를 복사해 붙여넣은 뒤에도 월 기준으로 날짜/유형별 묶음이 생성되는지 확인합니다.
16. 시트 전체 미리보기에서 미일치/동명이인/미승인 회원이 있으면 반영이 막히는지 확인합니다.
17. 시트 반영을 한 번 더 실행해도 이미 반영된 출석은 중복 저장되지 않는지 확인합니다.

## 운영진 시스템 점검
- 운영 관리의 `시스템` 탭에 `시스템 점검` 섹션을 추가했습니다.
- 점검 데이터는 `/.netlify/functions/admin-healthcheck`에서만 조회하며, Supabase Auth JWT와 `member_profiles.role = admin`, `approval_status = approved`를 서버에서 확인합니다.
- 회원가입 상태: Auth user 수, members row 수, pending/approved/rejected 수, Auth/Profile/Member 매칭 의심 건수를 표시합니다.
- 승인 대기: 이름, 마스킹 이메일, 이메일 인증 여부, 신청일을 표시합니다.
- 출석 데이터 상태: 이번 달 출석 로그 수, 최근 출석일, 날짜/유형 중복 의심, 미매칭 이름 수, 휴면 회원 출석 의심을 표시합니다.
- 월별 출석 요약: `attendance_logs.matched` 기준 출석 수와 `members.monthly_runs` 요약값 불일치를 표시합니다.
- 포인트 상태: 중복 지급 의심, 승인 웰컴 포인트 미지급 회원 수를 표시합니다.
- 운영 로그: 최근 20개 운영 작업 로그를 표시하고 가입/승인/출석/포인트/추첨/회비 필터를 제공합니다.
- 복구 작업은 기본 미리보기이며, 실제 실행은 운영진 확인 후 `POST`로 처리하고 `operation_logs`에 기록합니다.
- 현재 `members.total_points` 컬럼은 없으므로 포인트 원장 합계와 총 포인트 컬럼 비교는 점검 노트로만 표시합니다.

### 시스템 점검 API
- `GET /.netlify/functions/admin-healthcheck?month=YYYY-MM`
- `POST /.netlify/functions/admin-healthcheck`
  - `action = recalc_monthly_attendance`, `confirmed = false`: 월별 출석 요약 재계산 미리보기
  - `action = recalc_monthly_attendance`, `confirmed = true`: `members.monthly_runs`를 원장 기준으로 보정
  - `action = grant_missing_welcome_points`, `confirmed = false`: 웰컴 포인트 미지급 회원 미리보기
  - `action = grant_missing_welcome_points`, `confirmed = true`: 누락 웰컴 포인트 지급

### 시스템 점검 테스트
1. 운영진은 운영 관리 `시스템` 탭에서 시스템 점검 섹션을 볼 수 있는지 확인합니다.
2. 일반 회원 또는 승인 전 회원 토큰으로 `admin-healthcheck`를 호출하면 거절되는지 확인합니다.
3. Auth/Profile/Member 매칭 불일치가 표시되는지 확인합니다.
4. 같은 날짜/유형 출석 로그 중복 의심이 표시되는지 확인합니다.
5. 월별 출석 요약 불일치가 표시되는지 확인합니다.
6. `월별 출석 재계산 미리보기`가 실제 DB 변경 없이 대상 목록만 보여주는지 확인합니다.
7. 확인 후 재계산 실행 시 `members.monthly_runs`와 `total_runs`가 보정되는지 확인합니다.
8. 웰컴 포인트 미지급 미리보기와 확인 후 지급이 동작하는지 확인합니다.
9. 복구/보정 작업이 `operation_logs`에 남는지 확인합니다.
10. 모바일 화면에서 점검 카드가 1열로 깨지지 않고 표시되는지 확인합니다.

## 챌린지 모드 운영
- 챌린지는 기존 `member_challenges`, `member_challenge_entries`, `member_point_awards`를 재사용합니다.
- 회원 기본 노출 모드는 `무료 참여형`, `포인트 예치형` 두 가지입니다.
- 무료 참여형: 참가 포인트 0P, 성공 보상 기본 30P, 실패 패널티 없음.
- 포인트 예치형: 예치 기본 30P 잠금, 성공 시 잠금 해제 + 보너스 기본 30P.
- 참가 포인트가 있는 챌린지는 참여 시 `locked_points`로 잠금 처리하고, 정산 전까지 활동 혜택 신청 가능 포인트에서 제외합니다.
- 팀 달성형/고급 정산형은 일반 회원 생성과 기본 목록에서 제외합니다. 필요하면 운영진이 별도 이벤트용으로만 관리합니다.

### 챌린지 DB 변경
- `member_challenges`: `mode`, `entry_points`, `success_reward_points`, `failure_policy`, `min_participants`, `verification_method`, `progress_current`, `progress_target`, `recruit_start_date`, `recruit_end_date`
- `member_challenge_entries`: `locked_points`, `settled_at`

### 챌린지 테스트
1. 무료 참여형 챌린지를 만들 수 있는지 확인합니다.
2. 무료 챌린지는 포인트가 없어도 참여 가능한지 확인합니다.
3. 포인트 예치형 챌린지는 포인트가 부족하면 참여가 거절되는지 확인합니다.
4. 포인트 예치형 챌린지 참여 시 사용 가능 포인트에서 잠금 포인트가 제외되는지 확인합니다.
5. 챌린지 취소 시 잠금 포인트가 해제되고 0P 반환 기록이 남는지 확인합니다.
6. 일반 회원이 팀 달성형/고급 정산형을 직접 생성할 수 없는지 확인합니다.
7. 같은 회원이 같은 챌린지에 두 번 참여할 수 없는지 확인합니다.
8. 운영진이 성공/실패 판정 후 정산하면 `member_point_awards`에 보상/정산 기록이 남는지 확인합니다.
9. 정산 완료된 챌린지는 다시 정산하거나 상태 변경할 수 없는지 확인합니다.
10. 모바일 화면에서 챌린지 카드와 참가 버튼이 줄바꿈되며 깨지지 않는지 확인합니다.

## 운영 메모
- 사진첩/댓글 포인트는 운영 단순화를 위해 사용하지 않음
- 룰렛 결과/기록은 메인에서 전체 공개
- 운영 체크 카드에서 회비 미납, 추첨 후보, 활동 리스크, 최근 출석 로그를 빠르게 확인
- 모바일에서는 토스 화면의 입금자 이름만 복사해 `이름 목록 납부 처리`로 회비 반영 가능
- 운영진(admin) 권한은 `OWNER_EMAIL`에 지정된 모임장 계정만 부여/해제
- 신규 가입 알림은 `APPROVAL_NOTIFY_WEBHOOK_URL`이 설정된 경우 자동 전송

