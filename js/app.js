/**
 * app.js - 유한상태머신(FSM) 메인 컨트롤러
 *
 * 상태 흐름:
 * INIT → SELECT → CAMERA_RED → CAMERA_YELLOW → CAMERA_GREEN → COUNTDOWN → CAPTURE → REVIEW → SUBMITTED
 *                                                                  ↑ 흔들림 시 ↓
 *                                                                  CAMERA_RED ←
 * SUBMITTED → SELECT (새 촬영)
 */
const App = (() => {
  // ===== 점검 항목 정의 =====
  const ITEMS = {
    extinguisher: {
      name: '소화기',
      guideText: '소화기를 이 선 안에 맞춰주세요',
      ttsGuide: '소화기 전체가 보이도록 맞춰주세요. 압력계가 잘 보이게 찍어주세요. 가만히 들고 계시면 자동으로 촬영됩니다.',
      // SVG viewBox 400x700 기준 마스크 & 아웃라인
      maskPath: 'M170,180 L170,160 Q170,140 185,135 L185,120 Q185,105 200,100 Q215,105 215,120 L215,135 Q230,140 230,160 L230,180 Q240,185 240,200 L240,520 Q240,545 215,550 L185,550 Q160,545 160,520 L160,200 Q160,185 170,180 Z',
      outlinePath: 'M170,180 L170,160 Q170,140 185,135 L185,120 Q185,105 200,100 Q215,105 215,120 L215,135 Q230,140 230,160 L230,180 Q240,185 240,200 L240,520 Q240,545 215,550 L185,550 Q160,545 160,520 L160,200 Q160,185 170,180 Z',
      // 압력계 원
      extraMask: '<circle cx="200" cy="110" r="18" fill="black"/>',
      extraOutline: '<circle cx="200" cy="110" r="18" fill="none" stroke-dasharray="6 4"/>'
    },
    gastank: {
      name: '가스통',
      guideText: '가스통을 이 선 안에 맞춰주세요',
      ttsGuide: '가스통과 밸브 전체가 보이게 맞춰주세요. 중간밸브가 잘 보여야 합니다. 가만히 들고 계시면 자동으로 촬영됩니다.',
      maskPath: 'M160,200 Q160,155 200,150 Q240,155 240,200 L240,500 Q240,545 200,550 Q160,545 160,500 Z',
      outlinePath: 'M160,200 Q160,155 200,150 Q240,155 240,200 L240,500 Q240,545 200,550 Q160,545 160,500 Z',
      // 밸브/조절기 상단
      extraMask: '<rect x="185" y="120" width="30" height="35" rx="4" fill="black"/>',
      extraOutline: '<rect x="185" y="120" width="30" height="35" rx="4" fill="none" stroke-dasharray="6 4"/>'
    },
    gashose: {
      name: '가스호스',
      guideText: '가스호스 전체를 화면에 담아주세요',
      ttsGuide: '가스호스 전체를 한 화면에 담아주세요. 연결 부분이 잘 보여야 합니다. 가만히 들고 계시면 자동으로 촬영됩니다.',
      // 가로로 긴 호스 형태
      maskPath: 'M60,310 Q60,280 90,280 L310,280 Q340,280 340,310 L340,390 Q340,420 310,420 L90,420 Q60,420 60,390 Z',
      outlinePath: 'M60,310 Q60,280 90,280 L310,280 Q340,280 340,310 L340,390 Q340,420 310,420 L90,420 Q60,420 60,390 Z',
      // 양쪽 연결부
      extraMask: '<rect x="40" y="300" width="25" height="100" rx="6" fill="black"/><rect x="335" y="300" width="25" height="100" rx="6" fill="black"/>',
      extraOutline: '<rect x="40" y="300" width="25" height="100" rx="6" fill="none" stroke-dasharray="6 4"/><rect x="335" y="300" width="25" height="100" rx="6" fill="none" stroke-dasharray="6 4"/>'
    },
    pipe: {
      name: '배관/전기',
      guideText: '배관과 전기시설을 화면에 담아주세요',
      ttsGuide: '배관과 주변 전기시설이 보이게 맞춰주세요. 배관 마감 부분이 잘 보여야 합니다. 가만히 들고 계시면 자동으로 촬영됩니다.',
      // 넓은 직사각형 (배관 영역)
      maskPath: 'M80,200 L320,200 Q330,200 330,210 L330,500 Q330,510 320,510 L80,510 Q70,510 70,500 L70,210 Q70,200 80,200 Z',
      outlinePath: 'M80,200 L320,200 Q330,200 330,210 L330,500 Q330,510 320,510 L80,510 Q70,510 70,500 L70,210 Q70,200 80,200 Z',
      // 배관 내부 십자 라인
      extraMask: '',
      extraOutline: '<line x1="70" y1="350" x2="330" y2="350" stroke-dasharray="8 6" opacity="0.5"/><line x1="200" y1="200" x2="200" y2="510" stroke-dasharray="8 6" opacity="0.5"/>'
    }
  };

  // ===== State =====
  let currentState = 'INIT';
  let selectedItem = null;
  let countdownInterrupted = false;
  let sensorAvailable = false;

  // ===== DOM =====
  const screens = {
    init: document.getElementById('screen-init'),
    select: document.getElementById('screen-select'),
    camera: document.getElementById('screen-camera'),
    review: document.getElementById('screen-review'),
    submitted: document.getElementById('screen-submitted'),
    error: document.getElementById('screen-error')
  };

  const guideText = document.getElementById('guide-text');
  const statusLabel = document.getElementById('status-label');
  const countdownDisplay = document.getElementById('countdown-display');
  const countdownNumber = document.getElementById('countdown-number');
  const reviewImage = document.getElementById('review-image');
  const btnManualCapture = document.getElementById('btn-manual-capture');
  const maskShape = document.getElementById('mask-shape');
  const guideOutline = document.getElementById('guide-outline');

  // ===== Screen Management =====
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name]?.classList.add('active');
  }

  // ===== SVG 오버레이 업데이트 =====
  const STATE_COLORS = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' };
  let currentColor = STATE_COLORS.red;

  function _updateOverlay(itemKey) {
    const item = ITEMS[itemKey];
    if (!item) return;

    // 마스크: 검정색으로 투명 영역 생성
    maskShape.innerHTML =
      `<path d="${item.maskPath}" fill="black"/>` +
      (item.extraMask || '');

    // 아웃라인: 점선 테두리 (상태 색상 직접 주입)
    guideOutline.innerHTML =
      `<path d="${item.outlinePath}" fill="none" stroke="${currentColor}" stroke-width="3" stroke-dasharray="10 6"/>` +
      (item.extraOutline || '').replace(/stroke-dasharray/g, `stroke="${currentColor}" stroke-width="2" stroke-dasharray`);
  }

  // ===== State Transitions =====
  function transition(newState) {
    console.log(`[FSM] ${currentState} → ${newState}`);
    currentState = newState;

    switch (newState) {
      case 'INIT':
        showScreen('init');
        break;

      case 'SELECT':
        showScreen('select');
        Camera.stop();
        Sensor.stopListening();
        Audio_.stopBeep();
        break;

      case 'CAMERA_RED':
        showScreen('camera');
        _setCameraState('red');
        countdownDisplay.classList.add('hidden');
        countdownInterrupted = false;
        Audio_.stopBeep();

        // 항목별 오버레이 + 가이드 텍스트 설정
        if (selectedItem) {
          _updateOverlay(selectedItem);
          guideText.textContent = ITEMS[selectedItem].guideText;
        }
        break;

      case 'CAMERA_YELLOW':
        _setCameraState('yellow');
        Audio_.startBeep('yellow');
        break;

      case 'CAMERA_GREEN':
        _setCameraState('green');
        Audio_.startBeep('green');
        // 즉시 카운트다운 진입
        if (currentState === 'CAMERA_GREEN') {
          transition('COUNTDOWN');
        }
        break;

      case 'COUNTDOWN':
        Audio_.stopBeep();
        countdownDisplay.classList.remove('hidden');
        guideText.textContent = '움직이지 마세요!';
        countdownInterrupted = false;

        Audio_.countdown(
          // onTick: 숫자 표시
          (num) => {
            countdownNumber.textContent = num;
            countdownNumber.style.animation = 'none';
            void countdownNumber.offsetWidth;
            countdownNumber.style.animation = '';
          },
          // onComplete: 촬영
          () => {
            if (!countdownInterrupted) {
              transition('CAPTURE');
            }
          },
          // onInterrupt: 중단 확인
          () => countdownInterrupted
        );
        break;

      case 'CAPTURE':
        countdownDisplay.classList.add('hidden');
        _doCapture();
        break;

      case 'REVIEW':
        showScreen('review');
        Sensor.stopListening();
        Audio_.stopBeep();
        break;

      case 'SUBMITTED':
        showScreen('submitted');
        Camera.stop();
        break;

      case 'ERROR':
        showScreen('error');
        Camera.stop();
        Sensor.stopListening();
        Audio_.stopBeep();
        break;
    }
  }

  // ===== Camera State Visual Updates =====
  function _setCameraState(color) {
    const cameraScreen = screens.camera;
    cameraScreen.classList.remove('state-red', 'state-yellow', 'state-green');
    cameraScreen.classList.add(`state-${color}`);

    // SVG 아웃라인 색상 실시간 업데이트
    currentColor = STATE_COLORS[color] || STATE_COLORS.red;
    if (selectedItem) {
      _updateOverlay(selectedItem);
    }

    const labels = {
      red: '안정되게 들어주세요',
      yellow: '좋습니다, 조금만 더...',
      green: '완벽합니다!'
    };
    statusLabel.textContent = labels[color];
  }

  // ===== Capture Logic =====
  function _doCapture() {
    Capture.flashEffect();
    Audio_.playShutter();

    const imageData = Capture.captureFrame();
    reviewImage.src = imageData;

    setTimeout(() => transition('REVIEW'), 500);
  }

  // ===== Sensor Callbacks =====
  function _onSensorStateChange(state) {
    if (currentState === 'COUNTDOWN') {
      if (state === 'red') {
        countdownInterrupted = true;
        transition('CAMERA_RED');
      }
      return;
    }

    if (!currentState.startsWith('CAMERA_')) return;

    if (state === 'red') {
      transition('CAMERA_RED');
    } else if (state === 'yellow') {
      if (currentState === 'CAMERA_RED') {
        transition('CAMERA_YELLOW');
      }
    }
  }

  function _onSensorStable() {
    if (currentState === 'CAMERA_YELLOW' || currentState === 'CAMERA_RED') {
      transition('CAMERA_GREEN');
    }
  }

  // ===== Startup =====
  async function _startCamera() {
    try {
      await Camera.start();
    } catch (err) {
      document.getElementById('error-title').textContent = err.title;
      document.getElementById('error-message').textContent = err.message;
      transition('ERROR');
      return;
    }

    // 센서 시작
    sensorAvailable = await Sensor.requestPermission();

    if (sensorAvailable) {
      Sensor.startListening({
        onStateChange: _onSensorStateChange,
        onStable: _onSensorStable
      });
      btnManualCapture.classList.add('hidden');
    } else {
      btnManualCapture.classList.remove('hidden');
      statusLabel.textContent = '촬영 버튼을 눌러주세요';
    }

    transition('CAMERA_RED');

    // 항목별 TTS 안내 재생
    if (selectedItem && ITEMS[selectedItem]) {
      Audio_.speakGuide(ITEMS[selectedItem].ttsGuide);
    }
  }

  // ===== Event Bindings =====
  function _bindEvents() {
    // 시작 버튼 → SELECT 화면
    document.getElementById('btn-start').addEventListener('click', () => {
      Audio_.init(); // 사용자 제스처 내에서 AudioContext 초기화
      transition('SELECT');
    });

    // 항목 선택 카드
    document.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedItem = card.dataset.item;
        console.log(`[SELECT] ${selectedItem} (${ITEMS[selectedItem]?.name})`);
        _startCamera();
      });
    });

    // 수동 촬영 버튼 (자이로 미지원 시)
    btnManualCapture.addEventListener('click', () => {
      if (currentState.startsWith('CAMERA_')) {
        transition('CAPTURE');
      }
    });

    // 리뷰: 제출
    document.getElementById('btn-submit').addEventListener('click', () => {
      transition('SUBMITTED');
    });

    // 리뷰: 다시 찍기
    document.getElementById('btn-retake').addEventListener('click', () => {
      Sensor.reset();
      if (sensorAvailable) {
        Sensor.startListening({
          onStateChange: _onSensorStateChange,
          onStable: _onSensorStable
        });
      }
      transition('CAMERA_RED');
    });

    // 완료: 다른 항목 촬영 → SELECT 복귀
    document.getElementById('btn-new').addEventListener('click', () => {
      transition('SELECT');
    });

    // 에러: 다시 시도
    document.getElementById('btn-retry').addEventListener('click', () => {
      _startCamera();
    });
  }

  // ===== Init =====
  function init() {
    _bindEvents();
    transition('INIT');
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { transition, init };
})();
