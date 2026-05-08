/**
 * auth.js — Supabase 认证模块 (v9)
 */

const Auth = {
  // Supabase 配置
  SUPABASE_URL: 'https://kdzwecziebiqxvviqmfa.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkendlY3ppZWJpcXh2dmlxbWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTI3NzYsImV4cCI6MjA5MTk2ODc3Nn0.WDZjzEQ1fIz_YSMy02rKGeCKx9f_a-5mQqcUsJmy1fU',

  client: null,

  // 初始化 Supabase client
  init() {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.warn('Supabase SDK not loaded, cloud sync disabled');
      return;
    }
    this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
    this.listenAuthChanges();
  },

  // 监听认证状态变化
  listenAuthChanges() {
    if (!this.client) return;
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // 登录成功，拉取云端数据
        Sync.pull().then(() => {
          // 如果当前在设置页，刷新显示
          if (App.currentPage === 'settings') {
            App.loadSettingsPage();
          }
        });
      } else if (event === 'SIGNED_OUT') {
        if (App.currentPage === 'settings') {
          App.loadSettingsPage();
        }
      }
    });
  },

  // 注册
  async signUp(email, password) {
    if (!this.client) throw new Error('云端服务未就绪');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // 登录
  async signIn(email, password) {
    if (!this.client) throw new Error('云端服务未就绪');
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // 退出
  async signOut() {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  },

  // 获取当前用户
  async getUser() {
    if (!this.client) return null;
    const { data: { user } } = await this.client.auth.getUser();
    return user;
  },

  // 快速检查是否已登录（同步方法，用 session）
  getSession() {
    if (!this.client) return null;
    // 使用缓存的 session
    return this.client.auth.getSession();
  },

  // 判断是否已登录
  async isLoggedIn() {
    const user = await this.getUser();
    return !!user;
  },
};
