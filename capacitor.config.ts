import type { CapacitorConfig } from '@capacitor/cli';

// Simulator / local dev:
//   npm run mobile:sync   (defaults to http://localhost:3005)
//
// App Store build — run ONCE after deploying to Vercel:
//   CAPACITOR_LIVE_URL=https://your-app.vercel.app npx cap sync ios
//   then Archive in Xcode.
const LIVE_URL = process.env.CAPACITOR_LIVE_URL || 'http://localhost:3005';
const isProduction = LIVE_URL.startsWith('https://');

const config: CapacitorConfig = {
  appId: 'com.paramsab.sportsvault',
  appName: 'SportsVault',
  webDir: 'out',

  server: {
    url: LIVE_URL,
    // cleartext only allowed for local dev (http). Never true for App Store build.
    cleartext: !isProduction,
    allowNavigation: isProduction ? [`${new URL(LIVE_URL).hostname}`] : [],
  },

  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    backgroundColor: '#0c0d0f',
    // Restrict navigation to our own domain in production builds.
    limitsNavigationsToAppBoundDomains: isProduction,
    preferredContentMode: 'mobile',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0c0d0f',
      iosSpinnerStyle: 'small',
      spinnerColor: '#c6f432',
      showSpinner: true,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0c0d0f',
    },
  },
};

export default config;
