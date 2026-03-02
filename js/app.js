/**
 * app.js - 유한상태머신(FSM) 메인 컨트롤러
 *
 * 상태 흐름:
 * INIT → CAMERA_RED → CAMERA_YELLOW → CAMERA_GREEN → COUNTDOWN → CAPTURE → REVIEW → SUBMITTED
 *                                                      ↑ 흔들림 시 ↓
 *                                                      CAMERA_RED ←
 */
const App = (() => {
  // ===== State =====
  let currentState = 'INIT';
  let countdownInterrupted = false;
  let sensorAvailable = false;

  // ===== DOM =====
  const screens = {
    init: document.getElementById('screen-init'),
    camera: document.getElementById('screen-camera'),
    review: document.getElementById('screen-review'),
    submitted: document.getElementById('screen-submitted'),
    error: document.getElementById('screen-error')
  };

  const guideBox = document.getElementById('guide-box');
  const guideText = document.getElementById('guide-text');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const countdownDisplay = document.getElementById('countdown-display');
  const countdownNumber = document.getElementById('countdown-number');
  const reviewImage = document.getElementById('review-image');
  const btnManualCapture = document.getElementById('btn-manual-capture');

  // ===== Screen Management =====
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name]?.classList.add('active');
  }

  // ===== State Transitions =====
  function transition(newState) {
    console.log(`[FSM] ${currentState} → ${newState}`);
    currentState = newState;

    switch (newState) {
      case 'INIT':
        showScreen('init');
        break;

      case 'CAMERA_RED':
        showScreen('camera');
        _setCameraState('red');
        countdownDisplay.classList.add('hidden');
        countdownInterrupted = false;
        Audio_.stopBeep();
        break;

      case 'CAMERA_YELLOW':
        _setCameraState('yellow');
        Audio_.startBeep('yellow');
        break;

      case 'CAMERA_GREEN':
        _setCameraState('green');
        Audio_.startBeep('green');
        // 자동으로 카운트다운 진입
        setTimeout(() => {
          if (currentState === 'CAMERA_GREEN') {
            transition('COUNTDOWN');
          }
        }, 300);
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
            // 펄스 애니메이션 리트리거
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

    const labels = {
      red: '안정되게 들어주세요',
      yellow: '좋습니다, 조금만 더...',
      green: '완벽합니다!'
    };
    statusLabel.textContent = labels[color];

    if (color === 'red') {
      guideText.textContent = '소화기를 이 선 안에 꽉 차게 맞춰주세요';
    }
  }

  // ===== Capture Logic =====
  function _doCapture() {
    Capture.flashEffect();
    Audio_.playShutter();

    const imageData = Capture.captureFrame();
    reviewImage.src = imageData;

    // 약간의 딜레이 후 리뷰 화면 전환
    setTimeout(() => transition('REVIEW'), 500);
  }

  // ===== Sensor Callbacks =====
  function _onSensorStateChange(state) {
    if (currentState === 'COUNTDOWN') {
      // 카운트다운 중 흔들리면 중단
      if (state === 'red') {
        countdownInterrupted = true;
        transition('CAMERA_RED');
      }
      return;
    }

    // 카메라 상태 중에만 반응
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
      // 자이로 미지원 → 수동 촬영 모드
      btnManualCapture.classList.remove('hidden');
      // status bar에 수동 모드 안내
      statusLabel.textContent = '촬영 버튼을 눌러주세요';
    }

    transition('CAMERA_RED');
  }

  // ===== Event Bindings =====
  function _bindEvents() {
    // 시작 버튼
    document.getElementById('btn-start').addEventListener('click', () => {
      Audio_.init(); // 사용자 제스처 내에서 AudioContext 초기화
      _startCamera();
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
    document.getElementById('btn-retake').addEventListener('click', async () => {
      Sensor.reset();
      if (sensorAvailable) {
        Sensor.startListening({
          onStateChange: _onSensorStateChange,
          onStable: _onSensorStable
        });
      }
      transition('CAMERA_RED');
    });

    // 완료: 새 사진
    document.getElementById('btn-new').addEventListener('click', () => {
      _startCamera();
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
