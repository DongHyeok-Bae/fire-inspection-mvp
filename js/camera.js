/**
 * camera.js - WebRTC 카메라 초기화, 플래시 토글, 에러 처리
 */
const Camera = (() => {
  let stream = null;
  let videoTrack = null;
  let flashOn = false;
  let torchSupported = false;

  const videoEl = document.getElementById('camera-video');
  const btnFlash = document.getElementById('btn-flash');

  /**
   * 카메라 시작
   * @returns {Promise<MediaStream>}
   */
  async function start() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw _mapError(err);
    }

    videoTrack = stream.getVideoTracks()[0];
    videoEl.srcObject = stream;

    // 트랙이 준비될 때까지 대기
    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve();
      };
    });

    // 토치(플래시) 지원 여부 확인
    _checkTorch();

    return stream;
  }

  /**
   * 카메라 정지
   */
  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      videoTrack = null;
    }
    videoEl.srcObject = null;
    flashOn = false;
    torchSupported = false;
    btnFlash.classList.add('hidden');
    btnFlash.classList.remove('flash-on');
  }

  /**
   * 플래시 토글
   */
  async function toggleFlash() {
    if (!torchSupported || !videoTrack) return;
    flashOn = !flashOn;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: flashOn }]
      });
      btnFlash.classList.toggle('flash-on', flashOn);
    } catch {
      // 토치 실패 시 무시
    }
  }

  /**
   * video 엘리먼트 반환 (capture에서 사용)
   */
  function getVideoElement() {
    return videoEl;
  }

  // --- Private ---

  function _checkTorch() {
    if (!videoTrack) return;
    const capabilities = videoTrack.getCapabilities?.();
    if (capabilities && capabilities.torch) {
      torchSupported = true;
      btnFlash.classList.remove('hidden');
    }
  }

  function _mapError(err) {
    const name = err.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        title: '카메라 사용을 허용해 주세요',
        message: '브라우저 설정에서 카메라 권한을 켜주세요.\n이 앱은 카메라 없이는 동작하지 않습니다.'
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        title: '카메라를 찾을 수 없습니다',
        message: '이 기기에 카메라가 연결되어 있는지 확인해 주세요.'
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        title: '카메라가 다른 앱에서 사용 중입니다',
        message: '다른 앱에서 카메라를 닫고 다시 시도해 주세요.'
      };
    }
    return {
      title: '카메라를 사용할 수 없습니다',
      message: '알 수 없는 오류가 발생했습니다.\n페이지를 새로고침하고 다시 시도해 주세요.'
    };
  }

  // 플래시 버튼 이벤트
  btnFlash.addEventListener('click', toggleFlash);

  return { start, stop, toggleFlash, getVideoElement };
})();
