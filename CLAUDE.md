# 카메라 MVP 프로토타입 (mvp_test)

## 목적

60대 이상 음식점 사장님이 주방 안전점검 대상을 **안정적으로 촬영**할 수 있는 모바일 웹앱.
자이로 센서로 흔들림을 감지하고, 안정 시 자동 촬영하며, 항목별 오버레이와 TTS 음성 안내를 제공한다.
Vanilla JS + Web API 기반, 프레임워크 없음.

---

## 디렉토리 구조

```
mvp_test/
├── CLAUDE.md               # 이 문서
├── index.html              # 진입점 (6개 풀스크린: INIT, SELECT, CAMERA, REVIEW, SUBMITTED, ERROR)
├── css/
│   └── style.css           # 전체 스타일 (CSS Grid, SVG 오버레이, 상태 색상)
├── js/
│   ├── app.js              # FSM 메인 컨트롤러 + ITEMS 설정 객체
│   ├── camera.js           # WebRTC 카메라 초기화, 플래시 토글
│   ├── sensor.js           # DeviceMotion/Orientation 자이로 안정화
│   ├── audio.js            # Web Audio 비프음, TTS 카운트다운/음성 안내, 셔터음
│   └── capture.js          # Canvas 프레임 캡처 + 플래시 효과
└── assets/
    └── extinguisher-guide.svg  # (legacy, 미사용 — 인라인 SVG 마스크로 대체)
```

---

## FSM 상태 흐름

```
[INIT] → 시작 터치
   ↓
[SELECT] → 4개 항목 중 1개 터치 (2x2 그리드)
   ↓ selectedItem 저장
[CAMERA_RED] → 항목별 SVG 오버레이 + TTS 안내 재생
   ↓ 자이로 안정화
[CAMERA_YELLOW] → 비프음 시작
   ↓ 1초간 안정 유지
[CAMERA_GREEN] → 즉시 카운트다운 진입
   ↓
[COUNTDOWN] → TTS "3, 2, 1" (3초)
   ↓ 완료            ↓ 흔들림 감지
[CAPTURE]          [CAMERA_RED] 복귀
   ↓
[REVIEW] → "이대로 제출하기" / "다시 찍기"
   ↓ 제출               ↓ 재촬영
[SUBMITTED]          [CAMERA_RED]
   ↓ 새 촬영
[SELECT] 복귀
```

---

## 4개 점검 항목

| # | 항목 | ID | 오버레이 | TTS 안내 핵심 |
|---|------|----|---------|-------------|
| 1 | 소화기 | `extinguisher` | 세로 실루엣 + 압력계 원 | 압력계가 잘 보이게 |
| 2 | 가스통 | `gastank` | 원통 + 상단 밸브 | 중간밸브가 잘 보이게 |
| 3 | 가스호스 | `gashose` | 가로 호스 + 양쪽 연결부 | 연결 부분이 잘 보이게 |
| 4 | 배관/전기 | `pipe` | 넓은 직사각형 + 십자 라인 | 배관 마감 부분이 잘 보이게 |

각 항목의 SVG 경로(`maskPath`, `outlinePath`, `extraMask`, `extraOutline`)는 `app.js`의 `ITEMS` 객체에 정의.

---

## 기술 스택

| 기술 | 용도 | 파일 |
|------|------|------|
| WebRTC `getUserMedia` | 후면 카메라 (1920x1080) | `camera.js` |
| DeviceMotionEvent | 자이로 각속도 → 흔들림 판별 | `sensor.js` |
| Web Audio API | 프로그레시브 비프음 + 셔터 백색소음 | `audio.js` |
| SpeechSynthesis API | 한국어 TTS (ko-KR, rate 1.5) | `audio.js` |
| Canvas 2D | 비디오 프레임 → JPEG 캡처 | `capture.js` |
| SVG `<mask>` | 항목별 점선 실루엣 컷아웃 오버레이 | `app.js` + `index.html` |

---

## 핵심 설정값

| 파라미터 | 값 | 파일 | 설명 |
|---------|-----|------|------|
| `THRESHOLD_RED` | 12 deg/s | `sensor.js` | 이상 = 흔들림 |
| `THRESHOLD_YELLOW` | 6 deg/s | `sensor.js` | 이상 = 안정화 중 |
| `STABLE_DURATION` | 1000 ms | `sensor.js` | 안정 유지 시간 |
| `WINDOW_SIZE` | 30 샘플 | `sensor.js` | 슬라이딩 윈도우 (~500ms @60Hz) |
| TTS rate | 1.5x | `audio.js` | 안내 + 카운트다운 속도 |
| 카운트다운 | 3초 (3→2→1) | `audio.js` | 각 1000ms 간격 |

---

## SVG 오버레이 기법

CSS `var(--guide-color)`은 JavaScript로 동적 생성한 SVG `innerHTML` 내 `stroke` 속성에서 사용 불가.
`STATE_COLORS = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }` 객체에서 직접 hex 색상을 주입하고,
`_setCameraState()`에서 `currentColor`를 갱신 → `_updateOverlay()`가 `maskShape`/`guideOutline` innerHTML을 교체.

---

## 모듈 의존 관계

```
camera.js ← capture.js (getVideoElement)
sensor.js ─┐
audio.js  ─┤← app.js (FSM 오케스트레이터)
capture.js ─┘
```

`index.html`에서 `camera → sensor → audio → capture → app` 순서로 로드.

---

## 배포

- **호스팅**: GitHub → Netlify 자동 배포 (push 시 ~1분 내 반영)
- **HTTPS 필수**: `getUserMedia`, `DeviceMotionEvent`는 Secure Context 필요
- **테스트**: Android Chrome에서 Netlify URL 접속

---

## 참고 문서

- `preinpectation/CLAUDE.md` — 전체 기술 검증 컨텍스트, 점검 대상 7개 카테고리
- `preinpectation/preprocessing_test/CLAUDE.md` — 이미지 전처리 파이프라인
- `preinpectation/rag_test/CLAUDE.md` — RAG 법규 기반 안전점검 분석
