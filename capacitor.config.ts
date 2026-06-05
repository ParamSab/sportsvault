import type { CapacitorConfig } from '@capacitor/cli';

// For Xcode simulator testing: defaults to the local dev server on port 3005.
// For App Store build: set CAPACITOR_LIVE_URL to your Vercel URL, e.g.
//   CAPACITOR_LIVE_URL=https://sportsvault.vercel.app npx cap sync ios
const LIVE_URL = process.env.CAPACITOR_LIVE_URL || 'http://localhost:3005';

const config: CapacitorConfig = {
  appId: 'com.paramsab.sportsvault',
  appName: 'SportsVault',
  webDir: 'out',

  server: {
    url: LIVE_URL,
    cleartext: LIVE_URL.startsWith('http://'),
  },

  ios: {
    contentInset: 'always',
    scrollEnabled: false,
    backgroundColor: '#070b15',
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#070b15',
      iosSpinnerStyle: 'small',
      spinnerColor: '#6366f1',
      showSpinner: true,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#070b15',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
