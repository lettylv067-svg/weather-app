/**
 * clothing.js — 穿衣规则引擎
 */

const Clothing = {
  // 默认规则表
  DEFAULT_RULES: [
    {
      id: 'scorching',
      label: '酷热',
      range: [33, 50],
      top: ['背心', '短袖'],
      bottom: ['短裤', '短裙'],
      accessory: ['遮阳帽', '防晒'],
      icons: { top: '👕', bottom: '🩳', accessory: '🧢' },
    },
    {
      id: 'hot',
      label: '热',
      range: [28, 32],
      top: ['短袖'],
      bottom: ['短裤', '薄长裤'],
      accessory: [],
      icons: { top: '👕', bottom: '🩳', accessory: '' },
    },
    {
      id: 'warm',
      label: '暖',
      range: [23, 27],
      top: ['短袖', '薄衬衫备着'],
      bottom: ['长裤'],
      accessory: [],
      icons: { top: '👔', bottom: '👖', accessory: '' },
    },
    {
      id: 'comfortable',
      label: '舒适',
      range: [18, 22],
      top: ['长袖', '薄卫衣'],
      bottom: ['长裤'],
      accessory: [],
      icons: { top: '🧥', bottom: '👖', accessory: '' },
    },
    {
      id: 'cool',
      label: '凉',
      range: [12, 17],
      top: ['卫衣', '毛衣+外套'],
      bottom: ['长裤'],
      accessory: [],
      icons: { top: '🧥', bottom: '👖', accessory: '' },
    },
    {
      id: 'cold',
      label: '冷',
      range: [5, 11],
      top: ['毛衣', '薄羽绒/大衣'],
      bottom: ['厚长裤'],
      accessory: ['围巾'],
      icons: { top: '🧥', bottom: '👖', accessory: '🧣' },
    },
    {
      id: 'freezing',
      label: '严寒',
      range: [-20, 4],
      top: ['保暖内衣', '厚羽绒'],
      bottom: ['保暖裤'],
      accessory: ['帽子', '围巾', '手套'],
      icons: { top: '🧥', bottom: '👖', accessory: '🧤' },
    },
  ],

  // 获取当前规则（带用户偏移）
  getRules() {
    const custom = Storage.getClothingRules();
    return custom || this.DEFAULT_RULES;
  },

  // 根据体感温度获取推荐
  getRecommendation(feelsLike) {
    const offset = Storage.getUserOffset();
    const adjustedTemp = feelsLike + offset;
    const rules = this.getRules();

    for (const rule of rules) {
      if (adjustedTemp >= rule.range[0] && adjustedTemp <= rule.range[1]) {
        return {
          ...rule,
          adjustedTemp,
          originalTemp: feelsLike,
        };
      }
    }

    // 兜底
    if (adjustedTemp > 50) return { ...rules[0], adjustedTemp, originalTemp: feelsLike };
    return { ...rules[rules.length - 1], adjustedTemp, originalTemp: feelsLike };
  },

  // 处理反馈
  handleFeedback(feelsLike, feedback) {
    // feedback: 'too_cold' | 'just_right' | 'too_hot'
    const currentOffset = Storage.getUserOffset();
    
    switch (feedback) {
      case 'too_cold':
        // 用户觉得冷，说明推荐太薄了，全局偏移减小（让体感温度感知更低→推荐更厚）
        Storage.setUserOffset(currentOffset - 1);
        return '已记住，下次会推荐更暖和的搭配';
      
      case 'too_hot':
        // 用户觉得热，全局偏移增大
        Storage.setUserOffset(currentOffset + 1);
        return '已记住，下次会推荐更清凉的搭配';
      
      case 'just_right':
        // 当前规则OK，不调整
        return '太好了，记住了这个体感';
      
      default:
        return '';
    }
  },

  // 获取当前偏移描述
  getOffsetDescription() {
    const offset = Storage.getUserOffset();
    if (offset === 0) return '标准体质';
    if (offset < 0) return `偏怕冷 (${Math.abs(offset)}级)`;
    return `偏怕热 (${offset}级)`;
  },
};
