const base = {
  contrast: 100,
  hdrContrast: 100,
  edge: 12,
  spreadFadeStart: 15,
  spreadFadeCurve: 35,
  frameBlending: false,
  frameFading: 0,
  debandingStrength: 0,
  fixedPosition: false
};
export const presets = [{
  id: 'soft',
  label: '은은하게',
  description: '밝기와 채도를 낮춘 부드러운 조명',
  values: {
    ...base,
    brightness: 80,
    saturation: 85,
    vibrance: 90,
    hdrBrightness: 80,
    hdrSaturation: 85,
    blur2: 40,
    spread: 14,
    flickerReduction: 25,
    resolution: 50,
    framerateLimit: 30,
    energySaver: true
  }
}, {
  id: 'cinema',
  label: '영화',
  description: '넓고 차분하게 퍼지는 조명',
  values: {
    ...base,
    brightness: 90,
    saturation: 95,
    vibrance: 100,
    hdrBrightness: 90,
    hdrSaturation: 95,
    blur2: 45,
    spread: 24,
    flickerReduction: 20,
    resolution: 50,
    framerateLimit: 60,
    energySaver: true
  }
}, {
  id: 'music',
  label: '다이나믹',
  description: '선명한 색상과 빠른 장면 반응',
  values: {
    ...base,
    brightness: 100,
    saturation: 110,
    vibrance: 110,
    hdrBrightness: 100,
    hdrSaturation: 110,
    blur2: 20,
    spread: 150,
    flickerReduction: 0,
    resolution: 100,
    framerateLimit: 60,
    energySaver: false
  }
}, {
  id: 'eco',
  label: '저사양',
  description: '낮은 해상도와 초당 24프레임으로 조명 부하 완화',
  values: {
    ...base,
    brightness: 90,
    saturation: 100,
    vibrance: 100,
    hdrBrightness: 90,
    hdrSaturation: 100,
    blur2: 20,
    spread: 12,
    flickerReduction: 0,
    resolution: 25,
    framerateLimit: 24,
    energySaver: true
  }
}];
export function getPresetValues(preset, config, webGL, webGLOnly) {
  return Object.fromEntries(Object.entries(preset.values).filter(([name]) => config.some(setting => setting.name === name && !setting.disabled) && (webGL || !webGLOnly.includes(name))));
}
