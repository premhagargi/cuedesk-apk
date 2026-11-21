import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cuedesk.app',
  appName: 'CueDesk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    adjustMarginsForEdgeToEdge: 'force'
  }
};

export default config;
