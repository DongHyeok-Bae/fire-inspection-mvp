/**
 * sensor.js - DeviceMotion/Orientation 자이로 안정화 감지
 *
 * 상태: RED (>12 deg/s) → YELLOW (6~12 deg/s) → STABLE (<6 deg/s)
 * 안정 상태 1초 연속 유지 시 onStable 콜백 호출
 */
const Sensor = (() => {
  // 임계값 (완화됨 — 일반적 손떨림 무시, 큰 움직임만 감지)
  const THRESHOLD_RED = 12;      // deg/s 이상 = 흔들림
  const THRESHOLD_YELLOW = 6;    // deg/s 이상 = 안정화 중
  const STABLE_DURATION = 1000;  // ms 연속 안정 유지 필요
  const WINDOW_SIZE = 30;        // 슬라이딩 윈도우 샘플 수 (~500ms @60Hz)

  let supported = false;
  let listening = false;
  let samples = [];
  let stableStartTime = null;
  let lastOrientation = null;
  let lastOrientationTime = null;
  let useMotion = true; // rotationRate 직접 사용 가능 여부

  // 콜백
  let onStateChange = null; // (state: 'red'|'yellow'|'green', magnitude: number) => void
  let onStable = null;      // () => void (1.5초 안정 달성)

  let currentState = 'red';

  /**
   * iOS 13+ 센서 권한 요청 (사용자 제스처 내에서 호출해야 함)
   * @returns {Promise<boolean>} 지원 여부
   */
  async function requestPermission() {
    // DeviceMotionEvent 권한 요청 (iOS 13+)
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== 'granted') {
          supported = false;
          return false;
        }
      } catch {
        supported = false;
        return false;
      }
    }

    // 지원 여부 테스트: DeviceMotionEvent 있으면 일단 지원으로 간주
    // (데스크탑에서는 이벤트가 발생하지 않으므로 타임아웃으로 판별)
    supported = await _detectSupport();
    return supported;
  }

  /**
   * 센서 리스닝 시작
   */
  function startListening(callbacks) {
    if (!supported) return;
    onStateChange = callbacks.onStateChange || null;
    onStable = callbacks.onStable || null;

    samples = [];
    stableStartTime = null;
    currentState = 'red';
    listening = true;

    if (useMotion) {
      window.addEventListener('devicemotion', _handleMotion);
    } else {
      window.addEventListener('deviceorientation', _handleOrientation);
    }
  }

  /**
   * 센서 리스닝 중지
   */
  function stopListening() {
    listening = false;
    window.removeEventListener('devicemotion', _handleMotion);
    window.removeEventListener('deviceorientation', _handleOrientation);
    samples = [];
    stableStartTime = null;
    currentState = 'red';
  }

  /**
   * 현재 상태 반환
   */
  function getState() {
    return currentState;
  }

  /**
   * 지원 여부 반환
   */
  function isSupported() {
    return supported;
  }

  /**
   * 강제 리셋 (카운트다운 중 흔들림 시)
   */
  function reset() {
    samples = [];
    stableStartTime = null;
    currentState = 'red';
    if (onStateChange) onStateChange('red', THRESHOLD_RED);
  }

  // --- Private ---

  function _handleMotion(e) {
    if (!listening) return;
    const rate = e.rotationRate;
    if (!rate) return;

    const magnitude = Math.sqrt(
      (rate.alpha || 0) ** 2 +
      (rate.beta || 0) ** 2 +
      (rate.gamma || 0) ** 2
    );

    _processSample(magnitude);
  }

  function _handleOrientation(e) {
    if (!listening) return;
    const now = performance.now();

    if (lastOrientation && lastOrientationTime) {
      const dt = (now - lastOrientationTime) / 1000; // seconds
      if (dt > 0 && dt < 0.5) {
        const dAlpha = Math.abs((e.alpha || 0) - (lastOrientation.alpha || 0));
        const dBeta = Math.abs((e.beta || 0) - (lastOrientation.beta || 0));
        const dGamma = Math.abs((e.gamma || 0) - (lastOrientation.gamma || 0));

        // 각도 차이를 시간으로 나눠 각속도(deg/s) 근사
        const magnitude = Math.sqrt(dAlpha ** 2 + dBeta ** 2 + dGamma ** 2) / dt;
        _processSample(magnitude);
      }
    }

    lastOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    lastOrientationTime = now;
  }

  function _processSample(magnitude) {
    samples.push(magnitude);
    if (samples.length > WINDOW_SIZE) {
      samples.shift();
    }

    // 슬라이딩 윈도우 평균
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const now = Date.now();

    let newState;
    if (avg > THRESHOLD_RED) {
      newState = 'red';
      stableStartTime = null;
    } else if (avg > THRESHOLD_YELLOW) {
      newState = 'yellow';
      stableStartTime = null;
    } else {
      // 안정 상태
      if (!stableStartTime) {
        stableStartTime = now;
      }
      const stableDuration = now - stableStartTime;

      if (stableDuration >= STABLE_DURATION) {
        newState = 'green';
      } else {
        newState = 'yellow';
      }
    }

    if (newState !== currentState) {
      currentState = newState;
      if (onStateChange) onStateChange(currentState, avg);
    }

    // GREEN 상태 진입 시 onStable 호출 (1회)
    if (currentState === 'green' && stableStartTime &&
        (now - stableStartTime) >= STABLE_DURATION &&
        (now - stableStartTime) < STABLE_DURATION + 100) {
      if (onStable) onStable();
    }
  }

  /**
   * 자이로 센서 실제 지원 여부 감지 (2초 타임아웃)
   */
  function _detectSupport() {
    return new Promise((resolve) => {
      if (typeof DeviceMotionEvent === 'undefined') {
        resolve(false);
        return;
      }

      let detected = false;
      const timeout = setTimeout(() => {
        if (!detected) {
          // 이벤트가 2초 내 발생하지 않으면 미지원
          window.removeEventListener('devicemotion', onMotion);
          window.removeEventListener('deviceorientation', onOrient);
          resolve(false);
        }
      }, 2000);

      function onMotion(e) {
        if (e.rotationRate &&
            (e.rotationRate.alpha !== null || e.rotationRate.beta !== null)) {
          detected = true;
          useMotion = true;
          clearTimeout(timeout);
          window.removeEventListener('devicemotion', onMotion);
          window.removeEventListener('deviceorientation', onOrient);
          resolve(true);
        }
      }

      function onOrient(e) {
        if (!detected && (e.alpha !== null || e.beta !== null)) {
          // rotationRate는 없지만 orientation은 있음 → 폴백
          detected = true;
          useMotion = false;
          clearTimeout(timeout);
          window.removeEventListener('devicemotion', onMotion);
          window.removeEventListener('deviceorientation', onOrient);
          resolve(true);
        }
      }

      window.addEventListener('devicemotion', onMotion);
      window.addEventListener('deviceorientation', onOrient);
    });
  }

  return { requestPermission, startListening, stopListening, getState, isSupported, reset };
})();
