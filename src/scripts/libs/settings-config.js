import { supportsColorMix, supportsWebGL } from './generic';
import { getBrowser } from './utils';
const SettingsConfig = [{
  type: 'section',
  label: "설정",
  name: 'sectionSettingsCollapsed',
  default: true
}, {
  name: 'advancedSettings',
  label: "고급 설정",
  type: 'checkbox',
  default: false
}, {
  type: 'section',
  label: "통계",
  name: 'sectionStatsCollapsed',
  default: true,
  advanced: true
}, {
  name: 'showFPS',
  label: "프레임 속도",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'showFrametimes',
  label: "프레임 시간 그래프",
  description: "CPU 사용량 증가",
  questionMark: {
    title: "이 측정은 CPU를 추가로 사용하므로 표시된 프레임 속도가 실제 성능과 같지는 않습니다. 다른 문제를 진단할 때 참고할 수 있습니다."
  },
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'showResolutions',
  label: "해상도 및 렌더링 시간",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'showBarDetectionStats',
  label: "여백 감지",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  type: 'section',
  label: "품질",
  name: 'sectionQualityPerformanceCollapsed',
  default: true
}, {
  name: 'webGL',
  label: "WebGL 렌더러 (전력 절약)",
  description: "변경하면 페이지가 새로고침됩니다",
  type: 'checkbox',
  default: true
}, {
  name: 'resolution',
  label: "해상도",
  type: 'list',
  default: 100,
  unit: '%',
  valuePoints: (() => {
    const points = [6.25];
    while (points[points.length - 1] < 400) {
      points.push(points[points.length - 1] * 2);
    }
    return points;
  })(),
  manualinput: false
}, {
  name: 'framerateLimit',
  label: "프레임 속도 제한 (초당)",
  type: 'list',
  default: 60,
  min: 0,
  max: 60,
  step: 1
}, {
  name: 'frameSync',
  label: "동기화",
  questionMark: {
    title: "조명과 영상 프레임의 동기화 방식입니다.\n\n디코딩: CPU와 GPU 사용량이 낮지만 프레임 누락이나 지연이 생길 수 있습니다.\n\n디스플레이: CPU와 GPU 사용량이 높습니다. 120Hz 이상 화면이나 1080p를 넘는 영상에서는 지연이 생길 수 있습니다.\n\n영상: 최신 브라우저 기술로 프레임을 동기화하며 CPU와 GPU 사용량이 낮습니다."
  },
  type: 'list',
  default: 2,
  min: 0,
  max: 2,
  step: 1,
  snapPoints: [{
    value: 0,
    label: "디코딩"
  }, {
    value: 1,
    label: "디스플레이"
  }, {
    value: 2,
    label: "영상"
  }],
  manualinput: false,
  advanced: true,
  experimental: true
}, {
  name: 'energySaver',
  label: "정적인 영상에서 전력 절약",
  questionMark: {
    title: "거의 움직이지 않는 영상의 프레임 속도를 제한합니다.\n\n정지 화면: 5초에 1프레임\n작은 움직임: 초당 1프레임"
  },
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'prioritizePageLoadSpeed',
  label: "페이지 로딩 속도 우선",
  description: "페이지 로딩 후 조명 효과를 불러옵니다",
  type: 'checkbox',
  default: true
}, {
  name: 'layoutPerformanceImprovements',
  label: "유튜브 반응 속도 개선",
  description: "페이지의 반응 속도를 개선합니다",
  questionMark: {
    title: "영상 페이지의 크기 변경, 댓글 및 관련 영상 로딩, 탐색 막대 조작, 실시간 채팅과 재생목록 스크롤 및 순서 변경을 개선합니다. 댓글이나 재생목록 항목이 많을 때 효과가 더 잘 드러납니다."
  },
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'debandingBlendMode',
  label: "색상 띠 완화 대상",
  questionMark: {
    title: "LCD의 어두운 색상 띠에는 일반 혼합이 유용합니다. OLED에서 완전한 검은색을 유지하려면 오버레이 혼합을 사용하세요."
  },
  type: 'list',
  default: 0,
  min: 0,
  max: 1,
  step: 1,
  snapPoints: [{
    value: 0,
    label: "LCD (일반)"
  }, {
    value: 1,
    label: "OLED (오버레이)"
  }],
  manualinput: false,
  advanced: true,
  new: true
}, {
  type: 'section',
  label: "페이지 헤더",
  name: 'sectionOtherPageHeaderCollapsed',
  default: true
}, {
  name: 'headerShadowSize',
  label: "그림자 크기",
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'headerShadowOpacity',
  label: "그림자 불투명도",
  type: 'list',
  default: 30,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'headerImagesOpacity',
  label: "이미지 불투명도",
  type: 'list',
  default: 100,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'headerFillOpacity',
  label: "배경 불투명도",
  description: "아래로 스크롤한 상태에서만 적용됩니다",
  type: 'list',
  default: 100,
  min: -100,
  max: 100,
  step: 0.1,
  advanced: true
}, {
  type: 'section',
  label: "페이지 콘텐츠",
  name: 'sectionOtherPageContentCollapsed',
  default: true
}, {
  name: 'surroundingContentShadowSize',
  label: "그림자 크기",
  type: 'list',
  default: 15,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'surroundingContentShadowOpacity',
  label: "그림자 불투명도",
  type: 'list',
  default: 30,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'surroundingContentTextAndBtnOnly',
  label: "텍스트와 버튼에만 그림자 적용",
  description: "스크롤과 영상의 끊김을 줄입니다",
  type: 'checkbox',
  advanced: true,
  default: true
}, {
  name: 'surroundingContentImagesOpacity',
  label: "이미지 불투명도",
  type: 'list',
  default: 100,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'surroundingContentFillOpacity',
  label: "버튼 및 상자 배경 불투명도",
  type: 'list',
  default: 10,
  min: -100,
  max: 100,
  step: 0.1
}, {
  name: 'pageBackgroundGreyness',
  label: "배경 회색 농도",
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'immersiveTheaterView',
  label: "영화관 모드에서 주변 콘텐츠 숨기기",
  type: 'checkbox',
  default: false
}, {
  name: 'relatedScrollbar',
  label: "관련 영상을 스크롤 목록으로 표시",
  description: "댓글 스크롤도 개선합니다",
  type: 'checkbox',
  advanced: true,
  default: false
}, {
  name: 'hideScrollbar',
  label: "스크롤바 숨기기",
  type: 'checkbox',
  advanced: true,
  default: false
}, {
  type: 'section',
  label: "영상",
  name: 'sectionVideoResizingCollapsed',
  default: true
}, {
  name: 'videoScale.SMALL',
  label: "크기 (기본 모드)",
  type: 'list',
  default: 100,
  min: 25,
  max: 200,
  step: 0.1,
  new: true
}, {
  name: 'videoScale.THEATER',
  label: "크기 (영화관 모드)",
  type: 'list',
  default: 100,
  min: 25,
  max: 200,
  step: 0.1,
  new: true
}, {
  name: 'videoScale.FULLSCREEN',
  label: "크기 (전체 화면)",
  type: 'list',
  default: 100,
  min: 25,
  max: 200,
  step: 0.1,
  new: true
}, {
  name: 'videoShadowSize',
  label: "그림자 크기",
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'videoShadowOpacity',
  label: "그림자 불투명도",
  type: 'list',
  default: 50,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'videoDebandingStrength',
  label: "색상 띠 완화 (노이즈)",
  questionMark: {
    title: "클릭하면 색상 띠 완화 (노이즈 / 디더링)에 관한 설명을 볼 수 있습니다.\nOLED에서 완전한 검은색을 유지하려면 품질 > 색상 띠 완화 대상을 OLED로 설정하세요.",
    href: 'https://www.lifewire.com/what-is-dithering-4686105'
  },
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 1,
  advanced: true
}, {
  name: 'videoOverlayEnabled',
  label: "영상과 앰비언트 라이트 동기화",
  questionMark: {
    title: "조명 처리 시간에 맞춰 영상 프레임을 지연시킵니다. 영상과 조명을 동기화하지만 끊김이나 프레임 누락이 생길 수 있습니다."
  },
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'videoOverlaySyncThreshold',
  label: "영상 동기화 해제 기준",
  description: "설정한 비율만큼 프레임이 누락되면 해제합니다",
  type: 'list',
  default: 5,
  min: 1,
  max: 100,
  step: 1,
  advanced: true
}, {
  name: 'chromiumBugVideoJitterWorkaround',
  label: "영상 떨림 보정",
  description: "CPU 및 GPU 사용량 증가",
  questionMark: {
    title: "60Hz보다 높은 주사율에서 발생할 수 있는 Chromium 영상 떨림을 보정합니다. 브라우저가 디스플레이 주사율에 맞춰 동작하도록 합니다.\n물음표를 클릭하면 원본의 문제 설명을 볼 수 있습니다.",
    href: 'https://github.com/WesselKroos/youtube-ambilight/issues/166'
  },
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'chromiumDirectVideoOverlayWorkaround',
  label: "영상 표시 오류 보정",
  description: "This workaround must be disabled for \\nNVidia RTX Virtual Super Resolution (VSR)",
  questionMark: {
    title: "하드웨어 가속 오버레이 (MPO)에서 발생할 수 있는 검은색 또는 흰색 사각형, 깜빡임, 찌그러진 영상 등의 표시 오류를 보정합니다.\n물음표를 클릭하면 자세한 설명을 볼 수 있습니다.",
    href: 'https://github.com/WesselKroos/youtube-ambilight/blob/master/TROUBLESHOOT.md#3-nvidia-rtx-video-super-resolution-vsr--nvidia-rtx-video-hdr-does-not-work'
  },
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  type: 'section',
  label: "검은색 및 유색 여백 제거",
  name: 'sectionHorizontalBarsCollapsed',
  default: true
}, {
  name: 'detectHorizontalBarSizeEnabled',
  label: "검은색 상하 여백 제거",
  description: "CPU 사용량 증가",
  type: 'checkbox',
  default: false,
  defaultKey: 'B'
}, {
  name: 'detectVerticalBarSizeEnabled',
  label: "검은색 좌우 여백 제거",
  description: "CPU 사용량 증가",
  type: 'checkbox',
  default: false,
  defaultKey: 'V'
}, {
  name: 'detectColoredHorizontalBarSizeEnabled',
  label: "감지: 유색 여백 제거",
  type: 'checkbox',
  default: false
}, {
  name: 'detectHorizontalBarSizeOffsetPercentage',
  label: "감지: 보정값",
  type: 'list',
  default: 0,
  min: -5,
  max: 5,
  step: 0.1,
  advanced: true
}, {
  name: 'barSizeDetectionAverageHistorySize',
  label: "감지: 평균 프레임 수",
  questionMark: {
    title: "여백 크기의 평균을 계산할 프레임 수입니다.\n작을수록 빠르게 감지하지만 잘못 감지할 가능성도 높아집니다."
  },
  type: 'list',
  default: 4,
  min: 1,
  max: 30,
  step: 1,
  advanced: true
}, {
  name: 'barSizeDetectionAllowedElementsPercentage',
  label: "감지: 판정 기준",
  questionMark: {
    title: "10%에서는 명확한 여백만 제거합니다. 값을 높이면 일부 요소가 있는 여백도 제거하며, 더 높이면 중앙의 사각형 요소에 맞춰 잘릴 수 있습니다."
  },
  type: 'list',
  default: 20,
  min: 10,
  max: 90,
  step: 10
}, {
  name: 'barSizeDetectionAllowedUnevenBarsPercentage',
  label: "감지: 비대칭 허용 기준",
  questionMark: {
    title: "값을 높이면 상하 또는 좌우의 크기가 다른 여백도 감지합니다.\n다만 직선 형태의 사물이나 선을 여백으로 잘못 감지할 가능성도 높아집니다."
  },
  type: 'list',
  default: 10,
  min: 1,
  max: 50,
  step: 1,
  advanced: true,
  new: true
}, {
  name: 'horizontalBarsClipPercentage',
  label: "상하 여백 크기",
  type: 'list',
  default: 0,
  min: 0,
  max: 40,
  step: 0.1,
  snapPoints: [{
    value: 8.7,
    label: 8
  }, {
    value: 12.3,
    label: 12,
    flip: true
  }, {
    value: 13.5,
    label: 13
  }],
  advanced: true
}, {
  name: 'verticalBarsClipPercentage',
  label: "좌우 여백 크기",
  type: 'list',
  default: 0,
  min: 0,
  max: 40,
  step: 0.1,
  advanced: true
}, {
  name: 'horizontalBarsClipPercentageReset',
  label: "다음 영상에서 여백 초기화",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'detectVideoFillScaleEnabled',
  label: "여백 제거 후 영상을 화면에 채우기",
  type: 'checkbox',
  default: false,
  defaultKey: 'H'
}, {
  type: 'section',
  label: "필터",
  name: 'sectionImageAdjustmentCollapsed',
  default: true
}, {
  name: 'brightness',
  label: "밝기",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1
}, {
  name: 'contrast',
  label: "대비",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1,
  advanced: true
}, {
  name: 'vibrance',
  label: "색상 선명도",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 0.1
}, {
  name: 'saturation',
  label: "채도",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1
}, {
  type: 'section',
  label: "HDR 필터",
  name: 'sectionHdrImageAdjustmentCollapsed',
  default: false,
  hdr: true
}, {
  name: 'hdrBrightness',
  label: "밝기",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1,
  hdr: true
}, {
  name: 'hdrContrast',
  label: "대비",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1,
  hdr: true
}, {
  name: 'hdrSaturation',
  label: "채도",
  type: 'list',
  default: 100,
  min: 0,
  max: 200,
  step: 1,
  hdr: true
}, {
  type: 'section',
  label: "조명 방향",
  name: 'sectionDirectionsCollapsed',
  default: true,
  advanced: true
}, {
  name: 'directionTopEnabled',
  label: "위",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'directionRightEnabled',
  label: "오른쪽",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'directionBottomEnabled',
  label: "아래",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'directionLeftEnabled',
  label: "왼쪽",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  type: 'section',
  label: "앰비언트 라이트",
  name: 'sectionAmbientlightCollapsed',
  default: false
}, {
  name: 'blur2',
  label: "흐림",
  description: "GPU 메모리 사용량 증가",
  type: 'list',
  default: 30,
  min: 0,
  max: 100,
  step: 0.1
}, {
  name: 'edge',
  label: "가장자리 크기",
  description: "변화를 확인하려면 흐림을 0%로 설정하세요",
  type: 'list',
  default: 12,
  min: 2,
  max: 50,
  step: 0.1,
  advanced: true
}, {
  name: 'spread',
  label: "확산 범위",
  description: "GPU 사용량 증가",
  type: 'list',
  default: 17,
  min: 0,
  max: 400,
  step: 0.1
}, {
  name: 'spreadFadeStart',
  label: "확산 페이드 시작점",
  type: 'list',
  default: 15,
  min: -50,
  max: 100,
  step: 0.1,
  advanced: true
}, {
  name: 'spreadFadeCurve',
  label: "확산 페이드 곡선",
  description: "변화를 확인하려면 흐림을 0%로 설정하세요",
  type: 'list',
  default: 35,
  min: 1,
  max: 100,
  step: 1,
  advanced: true
}, {
  name: 'debandingStrength',
  label: "색상 띠 완화 (노이즈)",
  questionMark: {
    title: "클릭하면 노이즈 / 디더링에 관한 설명을 볼 수 있습니다.\nOLED에서 완전한 검은색을 유지하려면 품질 > 색상 띠 완화 대상을 OLED로 설정하세요.",
    href: 'https://www.lifewire.com/what-is-dithering-4686105'
  },
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 1,
  advanced: true
}, {
  name: 'frameFading',
  label: "페이드 인 시간",
  description: "GPU 메모리 사용량 증가",
  questionMark: {
    title: "조명 색상이 바뀔 때 부드럽게 전환합니다."
  },
  type: 'list',
  default: 0,
  min: 0,
  max: 21.2,
  step: 0.02,
  manualinput: false
}, {
  name: 'flickerReduction',
  label: "깜빡임 완화",
  questionMark: {
    title: "조명 밝기의 변화 속도를 제한해 깜빡임을 줄입니다."
  },
  type: 'list',
  default: 0,
  min: 0,
  max: 100,
  step: 1,
  manualinput: false,
  advanced: true
}, {
  name: 'frameBlending',
  label: "부드러운 움직임 (프레임 혼합)",
  questionMark: {
    title: "클릭하면 프레임 혼합에 관한 설명을 볼 수 있습니다.",
    href: 'https://www.youtube.com/watch?v=m_wfO4fvH8M&t=81s'
  },
  description: "GPU 사용량 증가. 영상 동기화와 함께 사용할 수 있습니다",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'frameBlendingSmoothness',
  label: "움직임 보정 강도",
  type: 'list',
  default: 80,
  min: 0,
  max: 100,
  step: 1,
  advanced: true
}, {
  name: 'fixedPosition',
  label: "위치 고정",
  description: "페이지 스크롤 위치를 무시합니다",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  type: 'section',
  label: "보기 모드",
  name: 'sectionViewsCollapsed',
  default: false
}, {
  name: 'enableInViews',
  label: "사용할 보기 모드",
  type: 'list',
  manualinput: false,
  default: 0,
  min: 0,
  max: 5,
  step: 1,
  snapPoints: [{
    value: 0,
    label: "전체"
  }, {
    value: 1,
    label: "기본"
  }, {
    value: 2,
    hiddenLabel: "기본 및 영화관"
  }, {
    value: 3,
    label: "영화관"
  }, {
    value: 4,
    hiddenLabel: "영화관 및 전체 화면"
  }, {
    value: 5,
    label: "전체 화면"
  }]
}, {
  name: 'enableInPictureInPicture',
  label: "화면 속 화면 (PIP)",
  type: 'checkbox',
  default: false,
  advanced: true
}, {
  name: 'enableInEmbed',
  label: "삽입된 영상",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  name: 'enableInVRVideos',
  label: "VR / 360도 영상",
  type: 'checkbox',
  default: true,
  advanced: true
}, {
  type: 'section',
  label: "일반",
  name: 'sectionGeneralCollapsed',
  default: false
}, {
  name: 'theme',
  label: "테마",
  type: 'list',
  manualinput: false,
  default: 1,
  min: -1,
  max: 1,
  step: 1,
  snapPoints: [{
    value: -1,
    label: "라이트"
  }, {
    value: 0,
    label: "기본"
  }, {
    value: 1,
    label: "다크"
  }]
}, {
  name: 'enabled',
  label: "사용",
  type: 'checkbox',
  default: true,
  defaultKey: 'G'
}];
export const WebGLOnlySettings = ['resolution', 'vibrance', 'frameFading', 'flickerReduction', 'fixedPosition', 'chromiumBugVideoJitterWorkaround'];
let prepared = false;
export const prepareSettingsConfigOnce = () => {
  if (prepared) return;
  const settingsToRemove = [];
  for (const setting of SettingsConfig) {
    if (supportsWebGL()) {
      if (setting.name === 'resolution' && getBrowser() === 'Firefox') {
        setting.default = 50;
      }
    } else {
      if (WebGLOnlySettings.includes(setting.name)) {
        settingsToRemove.push(setting.name);
      }
      if (['webGL'].includes(setting.name)) {
        setting.default = false;
        setting.disabled = '브라우저에서 WebGL이 비활성화되어 있습니다.';
      }
    }
    if (setting.name === 'frameSync') {
      if (!HTMLVideoElement.prototype.requestVideoFrameCallback) {
        setting.max = 1;
        setting.default = 0;
      } else if (getBrowser() === 'Firefox') {
        setting.default = 0;
      }
    }
  }
  if (getBrowser() === 'Firefox') {
    settingsToRemove.push('enableInVRVideos');
  }
  if (!supportsColorMix()) {
    settingsToRemove.push('pageBackgroundGreyness');
  }
  for (const settingName of settingsToRemove) {
    const settingIndex = SettingsConfig.findIndex(setting => setting.name === settingName);
    SettingsConfig.splice(settingIndex, 1);
  }
  prepared = true;
};
export default SettingsConfig;
