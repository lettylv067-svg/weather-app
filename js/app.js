/**
 * app.js — 主逻辑入口（重构版：3页面）
 */

const App = {
  currentPage: 'home',
  weatherData: null,
  compareWeatherData: null,
  citySearchOpen: false,

  async init() {
    this.bindNavigation();
    Auth.init();
    this.checkApiKey();
  },

  // 检查 API Key
  checkApiKey() {
    const key = Storage.getApiKey();
    if (!key) {
      this.showApiKeyPrompt();
    } else {
      this.loadHomePage();
    }
  },

  // 显示 API Key 输入
  showApiKeyPrompt() {
    const app = document.getElementById('app-content');
    app.innerHTML = `
      <div class="glass-card" style="margin-top: 40px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🌤️</div>
          <h2 style="font-family: var(--font-display); font-size: 21px; font-weight: 600; color: var(--color-ink);">说人话天气</h2>
          <p style="font-size: 14px; color: var(--color-body-muted); margin-top: 8px;">首次使用，请设置和风天气 API Key</p>
        </div>
        <input type="text" id="api-key-input" class="city-search-input" 
          placeholder="粘贴你的和风天气 API Key" style="margin-bottom: 12px;">
        <button onclick="App.saveApiKey()" class="btn-primary" style="width: 100%; padding: 14px;">
          开始使用
        </button>
        <p style="font-size: 12px; color: var(--color-ink-muted-48); margin-top: 12px; text-align: center;">
          免费注册：<a href="https://dev.qweather.com" target="_blank" class="text-link">dev.qweather.com</a>
        </p>
      </div>
    `;
  },

  saveApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    if (!key) {
      this.showToast('请输入 API Key');
      return;
    }
    Storage.setApiKey(key);
    this.showToast('设置成功！');
    setTimeout(() => this.loadHomePage(), 500);
  },

  // 绑定导航
  bindNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        this.switchPage(page);
      });
    });
  },

  switchPage(page) {
    this.currentPage = page;
    
    // 更新 tab 状态
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // 加载页面
    switch (page) {
      case 'home': this.loadHomePage(); break;
      case 'compare': this.loadComparePage(); break;
      case 'settings': this.loadSettingsPage(); break;
    }
  },

  // ==================== 页面1：当前温度 ====================
  async loadHomePage() {
    const app = document.getElementById('app-content');
    app.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">获取天气中...</div>
      </div>
    `;

    try {
      const city = Storage.getHomeCity();
      
      // 并行获取实时天气和今日预报
      const [weather, todayForecast] = await Promise.all([
        Weather.getNow(city.id),
        Weather.getTodayForecast(city.id).catch(() => null),
      ]);
      this.weatherData = weather;
      
      // 跨天检查：如果之前缓存的"今日数据"是昨天的，自动晋升为"昨日数据"
      Storage.promoteYesterdayIfNeeded(city.id);
      
      // 缓存今天的天气（独立存储，含 tempMax/tempMin）
      Storage.cacheTodayWeather(city.id, weather, todayForecast);

      // 获取昨天的数据（优先本地缓存，其次调历史API）
      let yesterday = Storage.getYesterdayData(city.id);
      const today = new Date().toISOString().split('T')[0];
      let showDelta = yesterday && yesterday.savedDate !== today;

      // 如果没有昨日数据，尝试从历史API拉取
      if (!showDelta) {
        try {
          const dateStr = Weather.getYesterdayDateStr();
          const histData = await Weather.getHistory(city.id, dateStr);
          if (histData) {
            const yesterdayDateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            yesterday = {
              temp: histData.temp,
              tempMax: histData.temp,        // 历史API的temp就是最高温
              tempMin: histData.tempMin,
              feelsLike: histData.temp,       // 向下兼容
              text: histData.textDay,
              savedDate: yesterdayDateStr,
            };
            // 缓存到昨日数据
            Storage.saveYesterdayData(city.id, yesterday);
            showDelta = true;
          }
        } catch (e) {
          console.log('历史天气获取失败，不影响主功能:', e.message);
        }
      }

      // ===== 温差模块（v6：最高温/最低温双维度）=====
      let deltaHTML = '';
      if (showDelta && todayForecast) {
        // 优先用预报的 tempMax/tempMin 对比
        const yMax = yesterday.tempMax !== undefined ? yesterday.tempMax : yesterday.feelsLike;
        const yMin = yesterday.tempMin !== undefined ? yesterday.tempMin : undefined;
        
        const delta = Compare.getDelta(todayForecast.tempMax, yMax, todayForecast.tempMin, yMin);
        const spread = Compare.getDailySpread(todayForecast.tempMax, todayForecast.tempMin, yMax, yMin);
        
        deltaHTML = `
          <div class="delta-section">
            <div class="delta-value ${delta.type}">${delta.display}</div>
            <div class="delta-label">${delta.text}</div>
            <div class="delta-badge ${delta.type}">${delta.type === 'warmer' ? '🔥 比昨天热' : delta.type === 'cooler' ? '❄️ 比昨天冷' : '🤝 跟昨天一样'}</div>
            ${delta.minDeltaText ? `<div class="delta-sub-info">${delta.minDeltaText}</div>` : ''}
            <div class="delta-hint">${delta.advice}</div>
            <div class="delta-spread">
              <span class="delta-spread-range">${spread.icon} ${spread.compareText}</span>
              <span class="delta-spread-strategy">${spread.strategy}</span>
            </div>
          </div>
        `;
      } else if (showDelta && !todayForecast) {
        // 降级：没有预报数据时用旧逻辑（实时体感对比）
        const yFeels = yesterday.feelsLike !== undefined ? yesterday.feelsLike : yesterday.tempMax;
        const delta = Compare.getDelta(weather.feelsLike, yFeels);
        deltaHTML = `
          <div class="delta-section">
            <div class="delta-value ${delta.type}">${delta.display}</div>
            <div class="delta-label">${delta.text}</div>
            <div class="delta-badge ${delta.type}">${delta.type === 'warmer' ? '🔥 比昨天热' : delta.type === 'cooler' ? '❄️ 比昨天冷' : '🤝 跟昨天一样'}</div>
            <div class="delta-hint">${delta.advice}</div>
          </div>
        `;
      } else {
        deltaHTML = `
          <div class="delta-section">
            <div class="empty-state-icon">📊</div>
            <div class="delta-label" style="margin-top: 8px;">明天开始就有对比啦</div>
            <div class="delta-hint">今天的数据已记录，明天打开就能看温差</div>
          </div>
        `;
      }

      // 穿衣建议模块
      const rec = Clothing.getRecommendation(weather.feelsLike);
      const allItems = [];
      rec.top.forEach(item => allItems.push({ name: item, icon: rec.icons.top }));
      rec.bottom.forEach(item => allItems.push({ name: item, icon: rec.icons.bottom }));
      rec.accessory.forEach(item => allItems.push({ name: item, icon: rec.icons.accessory }));

      const clothingHTML = `
        <div class="clothing-section">
          <div class="clothing-level">👔 穿衣建议 · ${rec.label}（${rec.range[0]}~${rec.range[1]}°C）</div>
          <div class="clothing-items">
            ${allItems.map(item => `
              <div class="clothing-item">
                <div class="clothing-item-icon">${item.icon}</div>
                <div class="clothing-item-name">${item.name}</div>
              </div>
            `).join('')}
          </div>
          <div class="feedback-section">
            <div class="feedback-prompt">这个推荐准吗？</div>
            <div class="feedback-buttons">
              <button class="feedback-btn" onclick="App.submitFeedback('too_cold')">🥶 太冷了</button>
              <button class="feedback-btn" onclick="App.submitFeedback('just_right')">👌 刚好</button>
              <button class="feedback-btn" onclick="App.submitFeedback('too_hot')">🥵 太热了</button>
            </div>
          </div>
        </div>
      `;

      app.innerHTML = `
        <div class="header">
          <div class="header-city" onclick="App.toggleCitySearch()">
            📍 ${city.name} <span style="font-size: 14px; color: var(--color-body-muted);">切换 ›</span>
          </div>
          <div class="header-date">${Compare.formatDate()}</div>
        </div>

        <!-- 快速切换城市 -->
        <div id="city-switch-panel" class="glass-card" style="display: none;">
          <input type="text" id="quick-city-search" class="city-search-input" 
            placeholder="搜索城市..." autofocus>
          <div id="quick-search-results" class="city-search-results"></div>
        </div>
        
        <div class="glass-card" style="animation-delay: 0.1s;">
          <div class="temp-hero">
            <div class="temp-current">${weather.temp}<span class="unit">°</span></div>
            <div class="temp-condition">${weather.text}${weather.feelsLike !== weather.temp ? ` · 体感 ${weather.feelsLike}°` : ''}</div>
          </div>
        </div>

        <div class="glass-card" style="animation-delay: 0.2s;">
          ${deltaHTML}
        </div>

        <div class="glass-card" style="animation-delay: 0.3s;">
          ${clothingHTML}
        </div>

        <div class="glass-card" style="animation-delay: 0.4s;">
          <div class="compare-row">
            <span class="compare-label">体感温度</span>
            <span class="compare-value">${weather.feelsLike}°C</span>
          </div>
          ${todayForecast ? `
          <div class="compare-row">
            <span class="compare-label">今日预报</span>
            <span class="compare-value">${todayForecast.tempMin}~${todayForecast.tempMax}°C</span>
          </div>
          ` : ''}
          <div class="compare-row">
            <span class="compare-label">湿度</span>
            <span class="compare-value">${weather.humidity}%</span>
          </div>
          <div class="compare-row">
            <span class="compare-label">风向</span>
            <span class="compare-value">${weather.windDir} ${weather.windScale}级</span>
          </div>
          ${showDelta && yesterday ? `
          <div class="compare-row">
            <span class="compare-label">昨日温度</span>
            <span class="compare-value">${yesterday.tempMin !== undefined ? yesterday.tempMin + '~' : ''}${yesterday.tempMax !== undefined ? yesterday.tempMax : yesterday.feelsLike}°C</span>
          </div>
          ` : ''}
        </div>
      `;

      // 绑定快速城市搜索
      this.bindQuickCitySearch();

    } catch (e) {
      app.innerHTML = `
        <div class="glass-card" style="margin-top: 40px;">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">${e.message}</div>
          </div>
        </div>
      `;
    }
  },

  // 切换城市搜索面板
  toggleCitySearch() {
    const panel = document.getElementById('city-switch-panel');
    if (!panel) return;
    this.citySearchOpen = !this.citySearchOpen;
    panel.style.display = this.citySearchOpen ? 'block' : 'none';
    if (this.citySearchOpen) {
      const input = document.getElementById('quick-city-search');
      if (input) input.focus();
    }
  },

  // 绑定快速城市搜索事件
  bindQuickCitySearch() {
    const searchInput = document.getElementById('quick-city-search');
    if (!searchInput) return;
    
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.quickSearchCity(searchInput.value), 400);
    });
  },

  async quickSearchCity(keyword) {
    const results = document.getElementById('quick-search-results');
    if (!keyword || keyword.length < 1) {
      results.innerHTML = '';
      return;
    }

    try {
      const cities = await Weather.searchCity(keyword);
      results.innerHTML = cities.map(city => `
        <div class="city-search-item" onclick="App.quickSwitchCity(${JSON.stringify(city).replace(/"/g, '&quot;')})">
          ${city.name}，${city.adm1} ${city.country !== '中国' ? '· ' + city.country : ''}
        </div>
      `).join('');
    } catch (e) {
      results.innerHTML = `<div class="city-search-item">${e.message}</div>`;
    }
  },

  quickSwitchCity(city) {
    Storage.setHomeCity(city);
    this.citySearchOpen = false;
    this.showToast(`已切换到 ${city.name}`);
    this.loadHomePage();
  },

  // 穿衣反馈
  submitFeedback(type) {
    const msg = Clothing.handleFeedback(this.weatherData.feelsLike, type);
    this.showToast(msg);
    setTimeout(() => this.loadHomePage(), 800);
  },

  // 跨城对比穿衣反馈
  submitCompareFeedback(type) {
    if (!this.compareWeatherData) return;
    const msg = Clothing.handleFeedback(this.compareWeatherData.feelsLike, type);
    this.showToast(msg);
  },

  // ==================== 页面2：跨城对比 ====================
  async loadComparePage() {
    const app = document.getElementById('app-content');
    const homeCity = Storage.getHomeCity();
    const compareCity = Storage.getCompareCity();

    app.innerHTML = `
      <div class="header">
        <div class="section-title">跨城对比</div>
        <div class="section-subtitle">看看目的地和你这儿差多少</div>
      </div>
      
      <div class="glass-card">
        <input type="text" id="city-search" class="city-search-input" 
          placeholder="搜索目的地城市..." value="${compareCity ? compareCity.name : ''}">
        <div id="search-results" class="city-search-results"></div>
      </div>

      <div id="compare-result"></div>
    `;

    // 绑定搜索
    const searchInput = document.getElementById('city-search');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.searchCity(searchInput.value), 400);
    });

    // 如果已有对比城市，直接加载
    if (compareCity) {
      this.loadCityComparison(homeCity, compareCity);
    }
  },

  async searchCity(keyword) {
    const results = document.getElementById('search-results');
    if (!keyword || keyword.length < 1) {
      results.innerHTML = '';
      return;
    }

    try {
      const cities = await Weather.searchCity(keyword);
      results.innerHTML = cities.map(city => `
        <div class="city-search-item" onclick="App.selectCompareCity(${JSON.stringify(city).replace(/"/g, '&quot;')})">
          ${city.name}，${city.adm1} ${city.country !== '中国' ? '· ' + city.country : ''}
        </div>
      `).join('');
    } catch (e) {
      results.innerHTML = `<div class="city-search-item">${e.message}</div>`;
    }
  },

  async selectCompareCity(city) {
    Storage.setCompareCity(city);
    document.getElementById('city-search').value = city.name;
    document.getElementById('search-results').innerHTML = '';
    
    const homeCity = Storage.getHomeCity();
    this.loadCityComparison(homeCity, city);
  },

  async loadCityComparison(homeCity, compareCity) {
    const container = document.getElementById('compare-result');
    container.innerHTML = `
      <div class="glass-card">
        <div class="loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">对比中...</div>
        </div>
      </div>
    `;

    try {
      const [homeWeather, compWeather] = await Promise.all([
        Weather.getNow(homeCity.id),
        Weather.getNow(compareCity.id),
      ]);

      const delta = Compare.getCityDelta(homeWeather, compWeather, homeCity.name, compareCity.name);

      // 目的地穿衣建议
      const rec = Clothing.getRecommendation(compWeather.feelsLike);
      const allItems = [];
      rec.top.forEach(item => allItems.push({ name: item, icon: rec.icons.top }));
      rec.bottom.forEach(item => allItems.push({ name: item, icon: rec.icons.bottom }));
      rec.accessory.forEach(item => allItems.push({ name: item, icon: rec.icons.accessory }));

      this.compareWeatherData = compWeather;

      container.innerHTML = `
        <div class="glass-card" style="animation-delay: 0.1s;">
          <div class="delta-section">
            <div class="delta-value ${delta.type}">${delta.display || '±0°C'}</div>
            <div class="delta-label">${delta.text}</div>
            <div class="delta-badge ${delta.type}">${delta.type === 'warmer' ? '🔥 更热' : delta.type === 'cooler' ? '❄️ 更冷' : '🤝 一样'}</div>
          </div>
        </div>

        <div class="glass-card" style="animation-delay: 0.2s;">
          <div class="city-compare-container">
            <div class="city-card">
              <div class="city-card-name">${homeCity.name}</div>
              <div class="city-card-temp">${homeWeather.temp}°</div>
              <div class="city-card-feels">体感 ${homeWeather.feelsLike}°</div>
              <div class="city-card-feels" style="margin-top: 4px;">${homeWeather.text}</div>
            </div>
            <div class="city-compare-vs">VS</div>
            <div class="city-card">
              <div class="city-card-name">${compareCity.name}</div>
              <div class="city-card-temp">${compWeather.temp}°</div>
              <div class="city-card-feels">体感 ${compWeather.feelsLike}°</div>
              <div class="city-card-feels" style="margin-top: 4px;">${compWeather.text}</div>
            </div>
          </div>
        </div>

        <div class="glass-card" style="animation-delay: 0.3s;">
          <div class="clothing-section">
            <div class="clothing-level">👔 去${compareCity.name}穿什么 · ${rec.label}（${rec.range[0]}~${rec.range[1]}°C）</div>
            <div class="clothing-items">
              ${allItems.map(item => `
                <div class="clothing-item">
                  <div class="clothing-item-icon">${item.icon}</div>
                  <div class="clothing-item-name">${item.name}</div>
                </div>
              `).join('')}
            </div>
            <div class="feedback-section">
              <div class="feedback-prompt">到${compareCity.name}后体感准吗？</div>
              <div class="feedback-buttons">
                <button class="feedback-btn" onclick="App.submitCompareFeedback('too_cold')">🥶 太冷了</button>
                <button class="feedback-btn" onclick="App.submitCompareFeedback('just_right')">👌 刚好</button>
                <button class="feedback-btn" onclick="App.submitCompareFeedback('too_hot')">🥵 太热了</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `
        <div class="glass-card">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">${e.message}</div>
          </div>
        </div>
      `;
    }
  },

  // ==================== 页面3：设置 ====================
  async loadSettingsPage() {
    const app = document.getElementById('app-content');
    const city = Storage.getHomeCity();
    const offset = Storage.getUserOffset();
    const offsetDesc = Clothing.getOffsetDescription();

    // 获取当前登录状态
    let user = null;
    try {
      user = await Auth.getUser();
    } catch (e) {}

    const accountHTML = user ? `
      <div class="glass-card" style="animation-delay: 0.3s;">
        <div style="margin-bottom: 16px; font-size: 17px; font-weight: 600; color: var(--color-ink);">☁️ 账号</div>
        <div class="setting-row">
          <span class="setting-label">已登录</span>
          <span class="setting-value" style="font-size: 14px; word-break: break-all;">${user.email}</span>
        </div>
        <div class="setting-row">
          <span class="setting-label">同步状态</span>
          <span class="setting-value" style="color: #34C759;">已开启</span>
        </div>
        <button onclick="App.handleSignOut()" class="btn-secondary" style="width: 100%; margin-top: 12px; padding: 12px;">
          退出登录
        </button>
      </div>
    ` : `
      <div class="glass-card" style="animation-delay: 0.3s;">
        <div style="margin-bottom: 16px; font-size: 17px; font-weight: 600; color: var(--color-ink);">☁️ 云端同步</div>
        <div style="font-size: 14px; color: var(--color-body-muted); margin-bottom: 16px;">登录后偏好设置自动同步，手机电脑都能用</div>
        <input type="email" id="auth-email" class="city-search-input" 
          placeholder="邮箱" style="margin-bottom: 8px;">
        <input type="password" id="auth-password" class="city-search-input" 
          placeholder="密码（至少6位）" style="margin-bottom: 12px;">
        <div style="display: flex; gap: 8px;">
          <button onclick="App.handleSignIn()" class="btn-primary" style="flex: 1; padding: 12px;">
            登录
          </button>
          <button onclick="App.handleSignUp()" class="btn-secondary" style="flex: 1; padding: 12px;">
            注册
          </button>
        </div>
        <div id="auth-error" style="font-size: 13px; color: #FF3B30; margin-top: 8px; display: none;"></div>
      </div>
    `;

    app.innerHTML = `
      <div class="header">
        <div class="section-title">设置</div>
      </div>

      <div class="glass-card">
        <div class="setting-row">
          <span class="setting-label">所在城市</span>
          <span class="setting-value">${city.name}</span>
        </div>
        <div class="setting-row">
          <span class="setting-label">体质偏好</span>
          <span class="setting-value">${offsetDesc}</span>
        </div>
        <div class="setting-row">
          <span class="setting-label">重置体质</span>
          <span class="setting-value" onclick="App.resetOffset()" style="color: var(--color-primary); cursor: pointer;">重置 ›</span>
        </div>
      </div>

      <div class="glass-card" style="animation-delay: 0.1s;">
        <div style="margin-bottom: 12px; font-size: 17px; font-weight: 600; color: var(--color-ink);">修改所在城市</div>
        <input type="text" id="home-city-search" class="city-search-input" 
          placeholder="搜索城市...">
        <div id="home-search-results" class="city-search-results"></div>
      </div>

      <div class="glass-card" style="animation-delay: 0.2s;">
        <div style="margin-bottom: 12px; font-size: 17px; font-weight: 600; color: var(--color-ink);">修改 API Key</div>
        <input type="text" id="settings-api-key" class="city-search-input" 
          placeholder="和风天气 API Key" value="${Storage.getApiKey()}">
        <button onclick="App.updateApiKey()" class="btn-primary" style="width: 100%; margin-top: 8px; padding: 12px;">
          保存
        </button>
      </div>

      ${accountHTML}
    `;

    // 绑定城市搜索
    const searchInput = document.getElementById('home-city-search');
    let timer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.searchHomeCity(searchInput.value), 400);
    });
  },

  async searchHomeCity(keyword) {
    const results = document.getElementById('home-search-results');
    if (!keyword) {
      results.innerHTML = '';
      return;
    }

    try {
      const cities = await Weather.searchCity(keyword);
      results.innerHTML = cities.map(city => `
        <div class="city-search-item" onclick="App.setHomeCity(${JSON.stringify(city).replace(/"/g, '&quot;')})">
          ${city.name}，${city.adm1} ${city.country !== '中国' ? '· ' + city.country : ''}
        </div>
      `).join('');
    } catch (e) {
      results.innerHTML = '';
    }
  },

  setHomeCity(city) {
    Storage.setHomeCity(city);
    this.showToast(`已切换到 ${city.name}`);
    setTimeout(() => this.loadSettingsPage(), 500);
  },

  updateApiKey() {
    const input = document.getElementById('settings-api-key');
    const key = input.value.trim();
    if (key) {
      Storage.setApiKey(key);
      this.showToast('API Key 已更新');
    }
  },

  resetOffset() {
    Storage.setUserOffset(0);
    this.showToast('体质偏好已重置');
    setTimeout(() => this.loadSettingsPage(), 500);
  },

  // ==================== 账号相关 ====================
  async handleSignIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');

    if (!email || !password) {
      this.showAuthError('请填写邮箱和密码');
      return;
    }

    try {
      errEl.style.display = 'none';
      await Auth.signIn(email, password);
      this.showToast('登录成功！数据已同步');
      // onAuthStateChange 会自动触发 pull + 页面刷新
    } catch (e) {
      this.showAuthError(this.translateAuthError(e.message));
    }
  },

  async handleSignUp() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
      this.showAuthError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      this.showAuthError('密码至少需要 6 位');
      return;
    }

    try {
      const data = await Auth.signUp(email, password);
      if (data.user && !data.session) {
        // 需要邮箱验证
        this.showToast('注册成功！请查收验证邮件');
      } else {
        this.showToast('注册并登录成功！');
      }
    } catch (e) {
      this.showAuthError(this.translateAuthError(e.message));
    }
  },

  async handleSignOut() {
    try {
      await Auth.signOut();
      this.showToast('已退出登录');
      this.loadSettingsPage();
    } catch (e) {
      this.showToast('退出失败：' + e.message);
    }
  },

  showAuthError(msg) {
    const errEl = document.getElementById('auth-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  },

  translateAuthError(msg) {
    if (msg.includes('Invalid login credentials')) return '邮箱或密码错误';
    if (msg.includes('User already registered')) return '该邮箱已注册，请直接登录';
    if (msg.includes('Email not confirmed')) return '邮箱未验证，请查收验证邮件';
    if (msg.includes('Password should be at least')) return '密码至少需要 6 位';
    if (msg.includes('Unable to validate email')) return '邮箱格式不正确';
    if (msg.includes('Email rate limit exceeded')) return '操作太频繁，请稍后再试';
    return msg;
  },

  // ==================== Toast ==================== 
  showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
