/**
 * weather.js — 和风天气 API 封装
 */

const Weather = {
  // API 基础配置
  BASE_URL: 'https://mv2x88xe6v.re.qweatherapi.com',
  GEO_URL: 'https://mv2x88xe6v.re.qweatherapi.com',

  getKey() {
    const key = Storage.getApiKey();
    if (!key) {
      throw new Error('请先设置和风天气 API Key');
    }
    return key;
  },

  // 通用请求
  async request(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === '200') {
        return data;
      } else {
        console.error('API Error:', data.code, url);
        throw new Error(`API 请求失败 (${data.code})`);
      }
    } catch (e) {
      if (e.message.includes('API Key')) throw e;
      console.error('Network Error:', e);
      throw new Error('网络请求失败，请检查网络连接');
    }
  },

  // 获取实时天气
  async getNow(locationId) {
    const key = this.getKey();
    const url = `${this.BASE_URL}/v7/weather/now?location=${locationId}&key=${key}&lang=zh`;
    const data = await this.request(url);
    return {
      temp: parseInt(data.now.temp),
      feelsLike: parseInt(data.now.feelsLike),
      text: data.now.text,
      humidity: parseInt(data.now.humidity),
      windDir: data.now.windDir,
      windSpeed: parseInt(data.now.windSpeed),
      windScale: data.now.windScale,
      icon: data.now.icon,
      obsTime: data.now.obsTime,
    };
  },

  // 获取未来天气预报（3天）
  async getForecast(locationId) {
    const key = this.getKey();
    const url = `${this.BASE_URL}/v7/weather/3d?location=${locationId}&key=${key}&lang=zh`;
    const data = await this.request(url);
    return data.daily.map(day => ({
      date: day.fxDate,
      tempMax: parseInt(day.tempMax),
      tempMin: parseInt(day.tempMin),
      textDay: day.textDay,
      textNight: day.textNight,
      iconDay: day.iconDay,
    }));
  },

  // 获取今日预报（最高温/最低温）
  async getTodayForecast(locationId) {
    const forecast = await this.getForecast(locationId);
    if (forecast && forecast.length > 0) {
      return {
        tempMax: forecast[0].tempMax,
        tempMin: forecast[0].tempMin,
        textDay: forecast[0].textDay,
      };
    }
    return null;
  },

  // 获取历史天气（最近10天可查）
  async getHistory(locationId, date) {
    const key = this.getKey();
    // date 格式为 yyyyMMdd
    const url = `${this.BASE_URL}/v7/historical/weather?location=${locationId}&date=${date}&key=${key}&lang=zh`;
    const data = await this.request(url);
    return {
      temp: parseInt(data.weatherDaily.tempMax),
      tempMin: parseInt(data.weatherDaily.tempMin),
      textDay: data.weatherDaily.textDay,
      // 使用逐小时数据计算平均体感温度，或用日温度近似
      hourly: (data.weatherHourly || []).map(h => ({
        temp: parseInt(h.temp),
        time: h.time,
      })),
    };
  },

  // 获取昨天的日期字符串（yyyyMMdd 格式）
  getYesterdayDateStr() {
    const d = new Date(Date.now() - 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  },

  // 城市搜索
  async searchCity(keyword) {
    const key = this.getKey();
    const url = `${this.GEO_URL}/geo/v2/city/lookup?location=${encodeURIComponent(keyword)}&key=${key}&lang=zh&number=5`;
    const data = await this.request(url);
    return (data.location || []).map(loc => ({
      id: loc.id,
      name: loc.name,
      adm1: loc.adm1,  // 省/州
      adm2: loc.adm2,  // 市
      country: loc.country,
    }));
  },

  // 获取天气条件对应的背景样式
  getWeatherTheme(icon) {
    const iconNum = parseInt(icon);
    // 晴天
    if ([100, 150].includes(iconNum)) return 'sunny';
    // 多云
    if ([101, 102, 103, 151, 152, 153].includes(iconNum)) return 'cloudy';
    // 阴天
    if ([104, 154].includes(iconNum)) return 'overcast';
    // 雨
    if (iconNum >= 300 && iconNum < 400) return 'rain';
    // 雪
    if (iconNum >= 400 && iconNum < 500) return 'snow';
    // 夜晚判断
    if (iconNum >= 150 && iconNum < 200) return 'night';
    return 'sunny';
  },

  // 应用天气主题背景
  applyTheme(theme) {
    const themes = {
      sunny: 'linear-gradient(180deg, #4A90D9 0%, #74B9FF 50%, #A8D8EA 100%)',
      cloudy: 'linear-gradient(180deg, #8E9EAB 0%, #B8C6DB 50%, #D5DEE7 100%)',
      overcast: 'linear-gradient(180deg, #636e72 0%, #b2bec3 100%)',
      rain: 'linear-gradient(180deg, #4B6CB7 0%, #5C7FBD 50%, #182848 100%)',
      snow: 'linear-gradient(180deg, #E6DADA 0%, #A8C0D6 100%)',
      night: 'linear-gradient(180deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
    };
    document.body.style.background = themes[theme] || themes.sunny;
  },
};
