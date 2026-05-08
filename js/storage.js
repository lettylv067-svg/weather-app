/**
 * storage.js — localStorage 工具封装（v9：增加云端同步触发）
 */

const Storage = {
  KEYS: {
    HOME_CITY: 'weather_home_city',
    COMPARE_CITY: 'weather_compare_city',
    YESTERDAY_DATA: 'weather_yesterday',
    TODAY_DATA: 'weather_today',
    CLOTHING_RULES: 'weather_clothing_rules',
    USER_OFFSET: 'weather_user_offset',
    API_KEY: 'weather_api_key',
  },

  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // 获取主城市
  getHomeCity() {
    return this.get(this.KEYS.HOME_CITY) || { name: '深圳', id: '101280601' };
  },

  setHomeCity(city) {
    this.set(this.KEYS.HOME_CITY, city);
    if (typeof Sync !== 'undefined') Sync.pushIfLoggedIn();
  },

  // 获取对比城市
  getCompareCity() {
    return this.get(this.KEYS.COMPARE_CITY);
  },

  setCompareCity(city) {
    this.set(this.KEYS.COMPARE_CITY, city);
    if (typeof Sync !== 'undefined') Sync.pushIfLoggedIn();
  },

  // ===== 昨日数据（只读，由历史API或跨天逻辑写入）=====
  getYesterdayData(cityId) {
    const all = this.get(this.KEYS.YESTERDAY_DATA) || {};
    return all[cityId] || null;
  },

  saveYesterdayData(cityId, data) {
    const all = this.get(this.KEYS.YESTERDAY_DATA) || {};
    all[cityId] = data; // 保持传入的完整数据，不覆盖 savedDate
    this.set(this.KEYS.YESTERDAY_DATA, all);
  },

  // ===== 今日数据缓存（用于明天跨天时变成"昨日数据"）=====
  getTodayData(cityId) {
    const all = this.get(this.KEYS.TODAY_DATA) || {};
    return all[cityId] || null;
  },

  // 缓存今天的天气（用于明天对比）— v6: 增加 tempMax/tempMin
  cacheTodayWeather(cityId, weatherData, forecastData) {
    const today = new Date().toISOString().split('T')[0];
    const all = this.get(this.KEYS.TODAY_DATA) || {};
    
    // 只在今天首次记录（或预报数据更新时覆盖）
    if (all[cityId] && all[cityId].savedDate === today && all[cityId].tempMax !== undefined) return;
    
    all[cityId] = {
      temp: weatherData.temp,
      feelsLike: weatherData.feelsLike,
      text: weatherData.text,
      humidity: weatherData.humidity,
      windSpeed: weatherData.windSpeed,
      savedDate: today,
      // v6 新增：预报的最高/最低温
      tempMax: forecastData ? forecastData.tempMax : undefined,
      tempMin: forecastData ? forecastData.tempMin : undefined,
    };
    this.set(this.KEYS.TODAY_DATA, all);
  },

  // 跨天检查：如果"今日缓存"是昨天的，将它转移到"昨日数据"
  promoteYesterdayIfNeeded(cityId) {
    const todayCache = this.getTodayData(cityId);
    if (!todayCache || !todayCache.savedDate) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (todayCache.savedDate !== today) {
      // 缓存的日期不是今天 → 它就是"昨天"的数据，晋升
      this.saveYesterdayData(cityId, todayCache);
      // 清除今日缓存，等今天重新缓存
      const all = this.get(this.KEYS.TODAY_DATA) || {};
      delete all[cityId];
      this.set(this.KEYS.TODAY_DATA, all);
    }
  },

  // 检查是否有可用的昨日对比数据
  hasValidYesterdayData(cityId) {
    const data = this.getYesterdayData(cityId);
    if (!data || !data.savedDate) return false;
    const today = new Date().toISOString().split('T')[0];
    // 昨日数据的保存日期不能是今天（否则说明它就是今天的）
    return data.savedDate !== today;
  },

  // 穿衣规则
  getClothingRules() {
    return this.get(this.KEYS.CLOTHING_RULES);
  },

  setClothingRules(rules) {
    this.set(this.KEYS.CLOTHING_RULES, rules);
  },

  // 用户体质偏移
  getUserOffset() {
    return this.get(this.KEYS.USER_OFFSET) || 0;
  },

  setUserOffset(offset) {
    this.set(this.KEYS.USER_OFFSET, offset);
    if (typeof Sync !== 'undefined') Sync.pushIfLoggedIn();
  },

  // API Key
  getApiKey() {
    return this.get(this.KEYS.API_KEY) || 'f73f68265eed43a49f77283375d34dd5';
  },

  setApiKey(key) {
    this.set(this.KEYS.API_KEY, key);
    if (typeof Sync !== 'undefined') Sync.pushIfLoggedIn();
  },
};
