const profiles = {
  theme01: {
    name: '轻拟态风', mode: 'light', style: 'soft',
    bg: 'F3F6FC', surface: 'FFFFFF', surface2: 'E8EEF9', text: '10213B', muted: '6F7C91',
    accent: '5B8DEF', accent2: '46B083', line: 'CDD8EA', font: 'Aptos', fontZh: 'Microsoft YaHei',
  },
  theme02: {
    name: '炫光紫绿风', mode: 'dark', style: 'neon',
    bg: '050A08', surface: '0D1713', surface2: '14251D', text: 'F1FFF4', muted: '8BA89A',
    accent: '76F06A', accent2: '65A9FF', line: '244335', font: 'Aptos', fontZh: 'Microsoft YaHei',
  },
  theme03: {
    name: '深浅代码风', mode: 'dark', style: 'code',
    bg: '0A0B0F', surface: '11141B', surface2: '191D27', text: 'F5F7FA', muted: '8791A5',
    accent: '2F5BFF', accent2: '8CA8FF', line: '282E3B', font: 'JetBrains Mono', fontZh: 'Microsoft YaHei',
  },
  theme04: {
    name: '玻璃糖果风', mode: 'dark', style: 'glass',
    bg: '070908', surface: '121714', surface2: '1C241E', text: 'F7F7F3', muted: '98A39B',
    accent: 'A8E72E', accent2: '62D9FF', line: '344039', font: 'Aptos', fontZh: 'Microsoft YaHei',
  },
  theme05: {
    name: '色谱图表风', mode: 'light', style: 'editorial',
    bg: 'F4F0E6', surface: 'FFFDF7', surface2: 'E9E1D2', text: '151515', muted: '6F675A',
    accent: 'FF5A1F', accent2: '93C928', line: 'C9BEAA', font: 'Arial', fontZh: 'Microsoft YaHei',
  },
  theme06: {
    name: '深色图谱风', mode: 'dark', style: 'spectrum',
    bg: '11131A', surface: '191D27', surface2: '252B37', text: 'F8F8F2', muted: '939BAC',
    accent: 'D9F326', accent2: '7F5CFF', line: '353C4B', font: 'Aptos', fontZh: 'Microsoft YaHei',
  },
  theme07: {
    name: '冷白调研风', mode: 'light', style: 'research',
    bg: 'F4F4F1', surface: 'FFFFFF', surface2: 'E8E9E2', text: '0D100A', muted: '666B61',
    accent: '8FD400', accent2: '23C76A', line: 'C8CBC1', font: 'Arial', fontZh: 'Microsoft YaHei',
  },
  theme08: {
    name: '黑金实验风', mode: 'light', style: 'collage',
    bg: 'F5F3ED', surface: 'FFFFFF', surface2: 'E9E5DA', text: '111111', muted: '716D63',
    accent: 'D6FF00', accent2: '7A5AE0', line: 'CFC9BB', font: 'Arial Black', fontZh: 'Microsoft YaHei',
  },
  theme09: {
    name: '深蓝杂志风', mode: 'dark', style: 'blue',
    bg: '061A6B', surface: '0A2A82', surface2: '123795', text: 'F2F5FF', muted: 'A8B8E8',
    accent: '7BA3FF', accent2: '2F7BFF', line: '3454A4', font: 'Aptos Display', fontZh: 'Microsoft YaHei',
  },
  theme10: {
    name: '金色指数风', mode: 'dark', style: 'gold',
    bg: '13212D', surface: '1D2D3A', surface2: '293B49', text: 'F6F2E8', muted: 'AEB4B7',
    accent: 'E8C99B', accent2: 'C99C5A', line: '40505B', font: 'Georgia', fontZh: 'Microsoft YaHei',
  },
  theme11: {
    name: '高能增长风', mode: 'light', style: 'growth',
    bg: 'F5F1EA', surface: 'FFFFFF', surface2: 'ECE4D7', text: '151515', muted: '766E63',
    accent: 'FF5B17', accent2: 'F9A13B', line: 'D2C7B8', font: 'Arial Black', fontZh: 'Microsoft YaHei',
  },
  theme12: {
    name: '声波霓虹风', mode: 'dark', style: 'waveform',
    bg: '070707', surface: '111111', surface2: '1B1B1B', text: 'F5F5F5', muted: '969696',
    accent: 'FF5A19', accent2: '2F7BFF', line: '303030', font: 'Aptos', fontZh: 'Microsoft YaHei',
  },
};

export function getThemeProfile(theme) {
  return profiles[String(theme || '').toLowerCase()] || profiles.theme01;
}

export function listThemeProfiles() {
  return Object.entries(profiles).map(([id, profile]) => ({ id, ...profile }));
}
