import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.unlikeotherai.cantare",
  appName: "Cantare",
  webDir: "dist",
  backgroundColor: "#0d0d0f",
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false },
  android: { backgroundColor: "#0d0d0f" },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: "#0d0d0f", showSpinner: false }
  }
};

export default config;
