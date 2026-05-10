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

  // ================== v10: 7 日双城趋势图 ==================
  // homeData / compareData：7 天预报数组
  render7dTrendChart(homeData, compareData, homeName, compareName) {
    if (!homeData || !compareData || homeData.length === 0) return '';

    const days = Math.min(7, homeData.length, compareData.length);
    const W = 320, H = 200;
    const PAD_L = 28, PAD_R = 18, PAD_T = 20, PAD_B = 40;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // 计算温度范围
    const allTemps = [];
    for (let i = 0; i < days; i++) {
      allTemps.push(homeData[i].tempMax, homeData[i].tempMin);
      allTemps.push(compareData[i].tempMax, compareData[i].tempMin);
    }
    const tMin = Math.min(...allTemps);
    const tMax = Math.max(...allTemps);
    const tRange = Math.max(tMax - tMin, 4);
    const tMinPad = tMin - 2;
    const tMaxPad = tMax + 2;
    const tRangePad = tMaxPad - tMinPad;

    // x / y 映射
    const x = (i) => PAD_L + (chartW / (days - 1)) * i;
    const y = (t) => PAD_T + chartH - ((t - tMinPad) / tRangePad) * chartH;

    // 日期轴标签
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const labels = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(homeData[i].date);
      const label = i === 0 ? '今' : i === 1 ? '明' : `周${weekDays[d.getDay()]}`;
      const day = d.getDate();
      labels.push({ x: x(i), label, day, rainHome: Weather.isRainyIcon(homeData[i].iconDay), rainCompare: Weather.isRainyIcon(compareData[i].iconDay) });
    }

    // 雨天背景柱（两城市各占一半，简单处理：两者都下雨才整列柱，否则用 ☔ 图标）
    const rainBgBars = labels.map((l, i) => {
      if (l.rainHome && l.rainCompare) {
        const barW = chartW / (days - 1) * 0.7;
        return `<rect x="${l.x - barW/2}" y="${PAD_T}" width="${barW}" height="${chartH}" fill="#0066cc" opacity="0.08" rx="4"/>`;
      }
      return '';
    }).join('');

    // 折线路径
    const line = (data, key) => {
      return data.slice(0, days).map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ');
    };

    const homePathMax = line(homeData, 'tempMax');
    const homePathMin = line(homeData, 'tempMin');
    const comparePathMax = line(compareData, 'tempMax');
    const comparePathMin = line(compareData, 'tempMin');

    // 数据点 + 温度标签
    const pointsHome = homeData.slice(0, days).map((d, i) => `
      <circle cx="${x(i)}" cy="${y(d.tempMax)}" r="3" fill="#0066cc"/>
      <circle cx="${x(i)}" cy="${y(d.tempMin)}" r="2.5" fill="#0066cc" opacity="0.5"/>
    `).join('');
    const pointsCompare = compareData.slice(0, days).map((d, i) => `
      <circle cx="${x(i)}" cy="${y(d.tempMax)}" r="3" fill="#FF6B35"/>
      <circle cx="${x(i)}" cy="${y(d.tempMin)}" r="2.5" fill="#FF6B35" opacity="0.5"/>
    `).join('');

    // 最高温数字标注（两城市分别标在点上方/下方避免重叠）
    const tempLabelsHome = homeData.slice(0, days).map((d, i) => 
      `<text x="${x(i)}" y="${y(d.tempMax) - 8}" text-anchor="middle" font-size="10" fill="#0066cc" font-weight="600">${d.tempMax}°</text>`
    ).join('');
    const tempLabelsCompare = compareData.slice(0, days).map((d, i) => 
      `<text x="${x(i)}" y="${y(d.tempMax) - 8}" text-anchor="middle" font-size="10" fill="#FF6B35" font-weight="600" opacity="${d.tempMax === homeData[i].tempMax ? 0 : 1}">${d.tempMax}°</text>`
    ).join('');

    // x 轴标签 + 雨天图标
    const xLabels = labels.map(l => `
      <text x="${l.x}" y="${H - 18}" text-anchor="middle" font-size="11" fill="#6e6e73" font-weight="500">${l.label}</text>
      <text x="${l.x}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#86868b">${l.day}日</text>
      ${(l.rainHome || l.rainCompare) ? `<text x="${l.x}" y="${PAD_T - 6}" text-anchor="middle" font-size="10">☔</text>` : ''}
    `).join('');

    return `
      <div class="trend-chart-wrapper">
        <div class="trend-chart-title">未来 7 天气温趋势</div>
        <div class="trend-chart-legend">
          <span class="trend-legend-item"><span class="trend-dot" style="background:#0066cc"></span>${homeName}</span>
          <span class="trend-legend-item"><span class="trend-dot" style="background:#FF6B35"></span>${compareName}</span>
          <span class="trend-legend-rain">☔ 雨天</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" class="trend-chart-svg" xmlns="http://www.w3.org/2000/svg">
          ${rainBgBars}
          <path d="${homePathMax}" stroke="#0066cc" stroke-width="2" fill="none"/>
          <path d="${homePathMin}" stroke="#0066cc" stroke-width="1.5" fill="none" stroke-dasharray="3,3" opacity="0.6"/>
          <path d="${comparePathMax}" stroke="#FF6B35" stroke-width="2" fill="none"/>
          <path d="${comparePathMin}" stroke="#FF6B35" stroke-width="1.5" fill="none" stroke-dasharray="3,3" opacity="0.6"/>
          ${pointsHome}
          ${pointsCompare}
          ${tempLabelsHome}
          ${tempLabelsCompare}
          ${xLabels}
        </svg>
        <div class="trend-chart-hint">实线 = 最高温，虚线 = 最低温</div>
      </div>
    `;
  },
};
