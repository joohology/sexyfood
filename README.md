# 증시 계기판 (공개 배포판)

## 배포 순서
1. github.com -> New repository -> 아무 이름 -> Create repository
2. 생성된 빈 저장소 페이지에서 "uploading an existing file" 클릭 -> 이 폴더 안의 파일/폴더를 통째로 드래그해서 올리고 Commit
3. vercel.com -> Add New -> Project -> 방금 만든 저장소 Import
4. 배포 전에 "Environment Variables"에 아래 3개 추가:
   - KIS_APP_KEY
   - KIS_APP_SECRET
   - TWELVE_DATA_KEY
5. Deploy 클릭. 끝나면 https://프로젝트이름.vercel.app 링크가 실제 공개 링크.

## 참고
- api/kr.js: 코스피/코스닥 실시간 (KIS Open API, 실전투자 도메인 기준)
- api/us.js: QQQ·SPY(S&P500 추종 ETF) 실시간(Twelve Data 무료 플랜) + 공포탐욕지수(CNN, 실시간) + VIX/10년물/WTI(수동 갱신 값, 이 파일 안 STATIC 객체를 고쳐서 갱신)
- 배포 직후 /api/kr?index=KOSPI 를 브라우저로 한번 열어서 정상 응답이 오는지 확인 권장. KIS 응답 필드명이 실제와 다르면 price 등이 null로 나오는데, 그 경우 응답 원문(raw 필드)을 캡처해서 알려주면 바로 고쳐줄 수 있음.
