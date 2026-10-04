export function validateBackup(input, config) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('설정 파일은 JSON 객체여야 합니다.');
  }
  const values = {
    ...input
  };
  if (Object.hasOwn(values, 'blur') && !Object.hasOwn(values, 'blur2')) values.blur2 = values.blur;
  delete values.blur;
  const settings = {};
  const warnings = [];
  const definitions = new Map(config.map(item => [item.name, item]));
  for (const [name, original] of Object.entries(values)) {
    const definition = definitions.get(name);
    if (!definition) {
      warnings.push(`${name}: 알 수 없는 설정을 제외했습니다.`);
      continue;
    }
    let value = original;
    if (definition.type === 'checkbox' || definition.type === 'section') {
      if (typeof value !== 'boolean') {
        warnings.push(`${name}: 참/거짓 값이 필요합니다.`);
        continue;
      }
    } else if (definition.type === 'list') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(`${name}: 유효한 숫자가 필요합니다.`);
        continue;
      }
      if (definition.valuePoints) {
        value = definition.valuePoints.reduce((best, point) => Math.abs(point - original) < Math.abs(best - original) ? point : best);
      } else {
        const min = definition.min ?? 0;
        const max = definition.max ?? Infinity;
        const step = definition.step ?? 0.1;
        value = Math.max(min, Math.min(max, value));
        value = Number((min + Math.round((value - min) / step) * step).toFixed(6));
        value = Math.max(min, Math.min(max, value));
      }
      if (value !== original) warnings.push(`${name}: 허용 범위에 맞춰 ${value}(으)로 조정했습니다.`);
    } else continue;
    settings[`setting-${name}`] = value;
  }
  if (!Object.keys(settings).length) throw new Error('가져올 유효한 설정이 없습니다.');
  return {
    settings,
    warnings
  };
}
