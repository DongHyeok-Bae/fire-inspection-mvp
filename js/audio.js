/**
 * audio.js - 비프음 프로그레시브, TTS 카운트다운, 셔터음
 */
const Audio_ = (() => {
  let audioCtx = null;
  let beepTimer = null;
  let ttsVoice = null;
  let ttsSupported = false;

  /**
   * AudioContext 초기화 (사용자 제스처 내에서 호출)
   */
  function init() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    _loadTTSVoice();
  }

  // ===== 비프음 =====

  /**
   * 상태에 따른 비프음 시작
   * @param {'red'|'yellow'|'green'} state
   */
  function startBeep(state) {
    stopBeep();
    if (state === 'red') return; // RED = 무음

    if (state === 'yellow') {
      _beepLoop(800, 440, 0.3);
    } else if (state === 'green') {
      _beepLoop(150, 880, 0.3);
    }
  }

  /**
   * 비프음 중지
   */
  function stopBeep() {
    if (beepTimer) {
      clearTimeout(beepTimer);
      beepTimer = null;
    }
  }

  /**
   * 단일 비프음 재생
   */
  function _playBeep(freq, volume, duration) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000);
  }

  function _beepLoop(interval, freq, volume) {
    _playBeep(freq, volume, 80);
    beepTimer = setTimeout(() => _beepLoop(interval, freq, volume), interval);
  }

  // ===== 셔터음 =====

  /**
   * 찰칵 셔터 사운드 (백색소음 버스트)
   */
  function playShutter() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.15; // 150ms
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // 지수 감쇠하는 백색소음
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.5;

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  }

  // ===== TTS 카운트다운 =====

  /**
   * TTS 카운트다운 실행: "완벽합니다" → "3" → "2" → "1"
   * @param {Function} onTick - (number) => void, 각 숫자 표시 시 호출
   * @param {Function} onComplete - 카운트다운 완료 시 호출
   * @param {Function} onInterrupt - 중단 확인 함수 (true 반환 시 중단)
   */
  function countdown(onTick, onComplete, onInterrupt) {
    const steps = [
      { text: '완벽합니다', delay: 1200, display: null },
      { text: '3', delay: 900, display: 3 },
      { text: '2', delay: 900, display: 2 },
      { text: '1', delay: 900, display: 1 }
    ];

    let index = 0;

    function next() {
      if (onInterrupt && onInterrupt()) return;
      if (index >= steps.length) {
        onComplete();
        return;
      }

      const step = steps[index];
      if (step.display !== null && onTick) {
        onTick(step.display);
      }

      _speak(step.text, step.display);
      index++;
      setTimeout(next, step.delay);
    }

    next();
  }

  /**
   * TTS 또는 비프 폴백으로 텍스트 읽기
   */
  function _speak(text, number) {
    if (ttsSupported && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = 1.1;
      utter.volume = 1.0;
      if (ttsVoice) utter.voice = ttsVoice;
      window.speechSynthesis.speak(utter);
    } else if (number !== null) {
      // TTS 미지원 폴백: 상승 비프 톤
      const freqMap = { 3: 660, 2: 770, 1: 880 };
      _playBeep(freqMap[number] || 660, 0.5, 200);
    }
  }

  function _loadTTSVoice() {
    if (!window.speechSynthesis) {
      ttsSupported = false;
      return;
    }

    function findKorean() {
      const voices = window.speechSynthesis.getVoices();
      ttsVoice = voices.find(v => v.lang.startsWith('ko')) || null;
      ttsSupported = voices.length > 0; // 한국어 없어도 TTS 자체는 시도
    }

    findKorean();

    // 비동기 음성 로딩 대응
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findKorean;
    }
  }

  return { init, startBeep, stopBeep, playShutter, countdown };
})();
