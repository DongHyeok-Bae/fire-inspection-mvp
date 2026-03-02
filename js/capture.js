/**
 * capture.js - Canvas 프레임 캡처 + 리뷰 화면 로직
 */
const Capture = (() => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let lastImageData = null;

  /**
   * 현재 비디오 프레임을 캡처하여 JPEG data URL 반환
   * @returns {string} JPEG data URL
   */
  function captureFrame() {
    const video = Camera.getVideoElement();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    lastImageData = canvas.toDataURL('image/jpeg', 0.92);
    return lastImageData;
  }

  /**
   * 마지막 캡처 이미지 반환
   */
  function getLastImage() {
    return lastImageData;
  }

  /**
   * 캡처 플래시 효과 실행
   */
  function flashEffect() {
    const flashEl = document.getElementById('capture-flash');
    flashEl.classList.remove('flash-active');
    // 리플로우 강제
    void flashEl.offsetWidth;
    flashEl.classList.add('flash-active');
    setTimeout(() => flashEl.classList.remove('flash-active'), 500);
  }

  return { captureFrame, getLastImage, flashEffect };
})();
