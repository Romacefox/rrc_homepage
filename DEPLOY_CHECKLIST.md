# 배포 직후 검수 체크리스트 (RRC)

## A. 배포 전 1회 설정
1. `script.js` 상단에 입력
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

2. Supabase SQL 실행
- `supabase/schema.sql`
- `supabase/policies.sql`

3. Netlify 환경변수 입력
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

4. 배포
- Netlify에서 Deploy 진행

## B. 기능 검수 (필수)
1. 메인/반응형
- PC/모바일에서 메인, 메뉴 이동 정상

2. 운영진 로그인
- 운영진 비밀번호 로그인 가능
- 공지 등록/삭제 정상

3. 회원/출석
- 회원 추가 가능
- 이름 단건 +1 가능
- 이름 다건(쉼표) +1 가능
- 소모임 명단 붙여넣기 일괄 반영 가능

4. 회비
- 월 선택 가능
- 납부/미납 버튼 정상
- 미납자 필터 정상
- CSV 다운로드 정상
- 연속 미납 경고 표시 정상

5. 위험 판정
- 참여/회비 상태 바꿨을 때 위험 목록 변동 확인

6. 대시보드
- 활동회원/평균참여/추첨대상/납부율/위험인원 표시
- 최근 6개월 추이 바 표시

7. 룰렛/추첨
- 룰렛 테스트 실행 정상
- 추첨 기록 표시 정상

8. 사진첩
- 회원가입 가능
- 로그인/로그아웃 가능
- 사진 업로드 가능
- 업로드 후 목록에 썸네일 표시

## C. 자동 추첨 검수
1. Netlify Scheduled Function 동작 확인
- 함수 로그에서 `monthly-draw` 성공 실행 확인

2. DB 반영 확인
- `raffle_history` 레코드 생성
- `notices`에 추첨 결과 공지 생성

## D. 보안/운영 확인
1. 관리자 비밀번호 변경
- `script.js`의 `ADMIN_PASSWORD` 변경 후 재배포

2. Supabase Auth 설정
- 이메일 인증 정책 선택(권장: 이메일 확인)

3. Storage 버킷 확인
- `rrc-photos` public 설정 및 정책 적용 확인

## E. 완료 후 공유해주실 것
1. Netlify 배포 URL
2. 테스트 계정 이메일(운영진/일반 1개씩)
3. 에러가 난 화면 캡처(있으면)
