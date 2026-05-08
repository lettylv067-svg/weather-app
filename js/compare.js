/**
 * compare.js — 体感对比 & 跨城市对比逻辑（v6：最高温/最低温双维度）
 */

const Compare = {
  // 计算温差（v6：基于最高温 + 最低温双维度）
  getDelta(todayMax, yesterdayMax, todayMin, yesterdayMin) {
    const maxDiff = todayMax - yesterdayMax;
    const minDiff = (todayMin !== undefined && yesterdayMin !== undefined) 
      ? todayMin - yesterdayMin : null;
    
    // 主温差基于最高温
    const abs = Math.abs(maxDiff);
    const warmer = maxDiff > 0;
    
    let advice = '';
    if (abs === 0) {
      advice = '穿昨天那套就行';
    } else if (abs <= 2) {
      advice = warmer ? '略暖一点，穿昨天的没问题' : '略凉一点，穿昨天的也行';
    } else if (abs <= 5) {
      advice = warmer ? '明显暖了，可以减一件' : '明显凉了，加一件外套';
    } else {
      advice = warmer ? '热了不少，大幅减衣' : '冷了不少，多穿几层';
    }

    // 辅助提示：最低温差≥3°C 时显示
    let minDeltaText = '';
    if (minDiff !== null && Math.abs(minDiff) >= 3) {
      const minAbs = Math.abs(minDiff);
      minDeltaText = minDiff > 0 
        ? `早晚也比昨天暖 ${minAbs}°C`
        : `⚠️ 早晚比昨天冷 ${minAbs}°C`;
    }

    return {
      value: maxDiff,
      text: maxDiff === 0 ? '和昨天一样' : (warmer ? `白天比昨天暖 ${abs}°C` : `白天比昨天冷 ${abs}°C`),
      type: maxDiff === 0 ? 'same' : (warmer ? 'warmer' : 'cooler'),
      advice,
      display: maxDiff === 0 ? '±0°C' : (warmer ? `+${abs}°C` : `-${abs}°C`),
      minDeltaText,
    };
  },

  // 今日早晚温差分析（v7：对比昨日温差）
  getDailySpread(tempMax, tempMin, yesterdayMax, yesterdayMin) {
    const spread = tempMax - tempMin;
    const hasYesterday = (yesterdayMax !== undefined && yesterdayMin !== undefined);
    const yesterdaySpread = hasYesterday ? (yesterdayMax - yesterdayMin) : null;
    const spreadDiff = hasYesterday ? (spread - yesterdaySpread) : null;

    // 对比昨日温差的文案
    let compareText = '';
    let icon = '';
    let strategy = '';

    if (spreadDiff !== null) {
      const absDiff = Math.abs(spreadDiff);
      if (absDiff <= 2) {
        compareText = '温差跟昨天差不多';
        icon = '👌';
        strategy = '穿法不用变';
      } else if (spreadDiff > 0) {
        compareText = `温差比昨天大 ${absDiff}°C`;
        icon = '🧥';
        strategy = spread >= 8 ? '早晚明显更凉，多带件外套' : '早晚比昨天凉，薄外套备上';
      } else {
        compareText = `温差比昨天小 ${absDiff}°C`;
        icon = '😊';
        strategy = '早晚没昨天那么凉，轻装出门';
      }
    } else {
      // 无昨日数据时降级为绝对值提示
      if (spread <= 3) {
        compareText = '今天温差小';
        icon = '👌';
        strategy = '一套搞定';
      } else if (spread <= 7) {
        compareText = `今天温差 ${spread}°C`;
        icon = '🧥';
        strategy = '早晚凉，带件薄外套';
      } else if (spread <= 12) {
        compareText = `今天温差 ${spread}°C`;
        icon = '🧅';
        strategy = '温差大，洋葱穿法';
      } else {
        compareText = `今天温差 ${spread}°C`;
        icon = '⚠️';
        strategy = '昼夜温差极大，注意增减衣物';
      }
    }

    return {
      spread,
      tempMax,
      tempMin,
      yesterdaySpread,
      spreadDiff,
      compareText,
      strategy,
      icon,
      display: `${tempMin}~${tempMax}°C`,
    };
  },

  // 跨城市对比
  getCityDelta(cityAWeather, cityBWeather, cityAName, cityBName) {
    const diff = cityBWeather.feelsLike - cityAWeather.feelsLike;
    
    if (diff === 0) {
      return {
        value: 0,
        text: `${cityBName}和${cityAName}体感一样`,
        type: 'same',
      };
    }

    const abs = Math.abs(diff);
    const bWarmer = diff > 0;

    return {
      value: diff,
      text: bWarmer 
        ? `${cityBName}比${cityAName}热 ${abs}°C`
        : `${cityBName}比${cityAName}冷 ${abs}°C`,
      type: bWarmer ? 'warmer' : 'cooler',
      display: bWarmer ? `+${abs}°C` : `-${abs}°C`,
    };
  },

  // 格式化日期
  formatDate(date) {
    const d = date || new Date();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${month}月${day}日 ${weekDays[d.getDay()]}`;
  },
};
