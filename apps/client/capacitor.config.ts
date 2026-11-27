import type { CapacitorConfig } from '@capacitor/cli';

const localHttp = process.env.OILGUARD_ANDROID_LOCAL_HTTP === 'true';

const config: CapacitorConfig = {
  appId: 'com.oilguard.monitoramento',
  appName: 'OILGUARD',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: localHttp,
  },
  plugins: {
    SystemBars: { style: 'DARK' },
  },
  android: {
    allowMixedContent: localHttp,
  },
};

export default config;
