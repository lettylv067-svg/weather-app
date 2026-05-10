/**
 * alerts.js — 天气提醒规则引擎 (v10)
 *
 * 输入：{ now, today, forecast, hourly, minutely, yesterday }
 * 输出：[{ priority, icon, title, detail, type }, ...]
 *
 * 优先级顺序（越小越靠前）：
 *   1 雨  2 降温  3 升温  4 高温  5 低温  6 大风  7 强紫外线
 */

const Alerts = {
  MAX_ALERTS: 2,

  // 主入口：输出最多 MAX_ALERTS 条提醒
  generate(ctx) {
    const alerts = [];

    const rainAlert = this.checkRain(ctx);
    if (rainAlert) alerts.push(rainAlert);

    const tempChangeAlert = this.checkTempChange(ctx);
    if (tempChangeAlert) alerts.push(tempChangeAlert);

    const extremeTempAlert = this.checkExtremeTemp(ctx);
    if (extremeTempAlert) alerts.push(extremeTempAlert);

    const windAlert = this.checkWind(ctx);
    if (windAlert) alerts.push(windAlert);

    const uvAlert = this.checkUV(ctx);
    if (uvAlert) alerts.push(uvAlert);

    // 按优先级排序，取前 N 条
    alerts.sort((a, b) => a.priority - b.priority);
    return alerts.slice(0, this.MAX_ALERTS);
  },

  // ================== 规则 1：下雨 ==================
  checkRain(ctx) {
    const { now, today, hourly, minutely } = ctx;

    // A. 分钟级降水（未来 2 小时内的精准预报）
    if (minutely && minutely.minutely && minutely.minutely.length > 0) {
      const rainMinute = minutely.minutely.find(m => m.precip > 0);
      if (rainMinute) {
        const rainTime = new Date(rainMinute.time);
        const hh = String(rainTime.getHours()).padStart(2, '0');
        const mm = String(rainTime.getMinutes()).padStart(2, '0');
        const diffMin = Math.round((rainTime - new Date()) / 60000);

        // 持续时长
        const rainPoints = minutely.minutely.filter(m => m.precip > 0);
        const durationMin = rainPoints.length * 5;

        let detail;
        if (diffMin <= 0 || now && Weather.isRainyIcon(now.icon)) {
          detail = `正在下雨，预计还要持续 ${durationMin} 分钟左右`;
        } else if (diffMin <= 10) {
          detail = `${hh}:${mm} 前后马上下雨（约 ${durationMin} 分钟）`;
        } else {
          detail = `${hh}:${mm} 前后有雨，预计持续 ${durationMin} 分钟`;
        }

        return {
          priority: 1,
          icon: '☔',
          title: '出门带伞',
          detail,
          type: 'rain',
        };
      }
    }

    // B. 24 小时预报（今天白天剩余时段有没有雨）
    if (hourly && hourly.length > 0) {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayRain = hourly.find(h => {
        const t = new Date(h.time);
        return t <= todayEnd && (Weather.isRainyIcon(h.icon) || h.precip > 0 || h.pop >= 60);
      });

      if (todayRain) {
        const t = new Date(todayRain.time);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        return {
          priority: 1,
          icon: '☔',
          title: '今天可能下雨',
          detail: `${hh}:${mm} 前后开始有雨，出门带把伞`,
          type: 'rain',
        };
      }
    }

    // C. 实时已经在下雨
    if (now && Weather.isRainyIcon(now.icon)) {
      return {
        priority: 1,
        icon: '☔',
        title: '正在下雨',
        detail: `现在是${now.text}，出门记得带伞`,
        type: 'rain',
      };
    }

    // D. 今日预报提示（无小时级数据时兜底）
    if (today && today.textDay && (today.textDay.includes('雨') || today.textDay.includes('阵雨'))) {
      return {
        priority: 1,
        icon: '☔',
        title: '今天有雨',
        detail: `白天${today.textDay}，带伞出门`,
        type: 'rain',
      };
    }

    return null;
  },

  // ================== 规则 2：降温/升温 ==================
  checkTempChange(ctx) {
    const { today, yesterday } = ctx;
    if (!today || !yesterday) return null;

    const yMax = yesterday.tempMax !== undefined ? yesterday.tempMax : yesterday.feelsLike;
    if (yMax === undefined) return null;

    const deltaMax = today.tempMax - yMax;

    if (deltaMax <= -5) {
      return {
        priority: 2,
        icon: '🧥',
        title: '明显降温',
        detail: `今天最高温比昨天低 ${Math.abs(deltaMax)}°C，加件外套`,
        type: 'cooling',
      };
    }
    if (deltaMax >= 5) {
      return {
        priority: 3,
        icon: '☀️',
        title: '明显升温',
        detail: `今天最高温比昨天高 ${deltaMax}°C，穿少点`,
        type: 'warming',
      };
    }
    return null;
  },

  // ================== 规则 3：极端温度（高温/低温）==================
  checkExtremeTemp(ctx) {
    const { today, now } = ctx;
    const maxTemp = today ? today.tempMax : (now ? now.temp : null);
    const minTemp = today ? today.tempMin : (now ? now.temp : null);

    if (maxTemp !== null && maxTemp >= 35) {
      return {
        priority: 4,
        icon: '🥵',
        title: '高温日',
        detail: `最高 ${maxTemp}°C，注意防晒、多喝水`,
        type: 'hot',
      };
    }
    if (minTemp !== null && minTemp <= 0) {
      return {
        priority: 5,
        icon: '🥶',
        title: '低温注意',
        detail: `最低 ${minTemp}°C，保暖别忘了`,
        type: 'cold',
      };
    }
    return null;
  },

  // ================== 规则 4：大风 ==================
  checkWind(ctx) {
    const { now } = ctx;
    if (!now) return null;
    const scale = parseInt(now.windScale);
    if (!isNaN(scale) && scale >= 5) {
      return {
        priority: 6,
        icon: '💨',
        title: '风大',
        detail: `${now.windDir} ${scale}级风，戴好帽子别感冒`,
        type: 'wind',
      };
    }
    return null;
  },

  // ================== 规则 5：强紫外线 ==================
  checkUV(ctx) {
    const { today7d } = ctx;
    if (!today7d || today7d.uvIndex === undefined) return null;
    if (today7d.uvIndex >= 8) {
      return {
        priority: 7,
        icon: '😎',
        title: '紫外线强',
        detail: `紫外线指数 ${today7d.uvIndex}，涂防晒别偷懒`,
        type: 'uv',
      };
    }
    return null;
  },
};
