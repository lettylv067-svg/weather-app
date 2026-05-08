/**
 * sync.js — 云端同步模块 (v9)
 * 负责将本地偏好同步到 Supabase user_preferences 表
 */

const Sync = {
  pushTimer: null,
  DEBOUNCE_MS: 2000,

  // 防抖推送：登录状态下调用，2秒内多次修改只推一次
  pushIfLoggedIn() {
    if (!Auth.client) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), this.DEBOUNCE_MS);
  },

  // 推送本地数据到云端
  async push() {
    try {
      const user = await Auth.getUser();
      if (!user) return;

      const prefs = {
        user_id: user.id,
        home_city: Storage.get(Storage.KEYS.HOME_CITY),
        compare_city: Storage.get(Storage.KEYS.COMPARE_CITY),
        user_offset: Storage.getUserOffset(),
        api_key: Storage.getApiKey(),
      };

      const { error } = await Auth.client
        .from('user_preferences')
        .upsert(prefs, { onConflict: 'user_id' });

      if (error) {
        console.warn('Sync push failed:', error.message);
      }
    } catch (e) {
      console.warn('Sync push error:', e.message);
    }
  },

  // 从云端拉取数据覆盖本地
  async pull() {
    try {
      const user = await Auth.getUser();
      if (!user) return;

      const { data, error } = await Auth.client
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // 如果是404（没有记录），说明是新用户，创建一条
        if (error.code === 'PGRST116') {
          await this.push(); // 首次登录，推送本地数据作为初始值
          return;
        }
        console.warn('Sync pull failed:', error.message);
        return;
      }

      if (!data) return;

      // 用云端数据覆盖本地
      if (data.home_city) {
        Storage.set(Storage.KEYS.HOME_CITY, data.home_city);
      }
      if (data.compare_city) {
        Storage.set(Storage.KEYS.COMPARE_CITY, data.compare_city);
      }
      if (data.user_offset !== null && data.user_offset !== undefined) {
        Storage.set(Storage.KEYS.USER_OFFSET, data.user_offset);
      }
      if (data.api_key) {
        Storage.set(Storage.KEYS.API_KEY, data.api_key);
      }

    } catch (e) {
      console.warn('Sync pull error:', e.message);
    }
  },
};
