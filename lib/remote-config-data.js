/**
 * GMAX remote config — EDIT THIS FILE + redeploy Vercel.
 * No APK rebuild needed for update popup or home ads.
 *
 * Deploy: cd gmax-premium-api && vercel --prod
 * Live:   GET https://gmax-premium-api.vercel.app/api/remote-config
 */

module.exports = {
  /** App update popup (in-app) */
  update: {
    enabled: true,
    version: '1.2.4',
    versionCode: 40,
    buildId: '39d042b8-d954-4348-92fc-927dd84de7e2',
    apkUrl:
      'https://github.com/gamxsharma305-png/gmax-android/releases/download/1.2.9/application-39d042b8-d954-4348-92fc-927dd84de7e2.1.apk',
    force: false,
    notes:
      'New build 1.2.9 — analytics, ads, fixes. Install recommended.',
  },

  /**
   * Home-screen influencer ads (max 2).
   * delaySeconds: wait after Home opens before first ad
   * skipAfterRatio: 0.5 = skip button after half video
   */
  ads: {
    enabled: true,
    delaySeconds: 10,
    maxAds: 2,
    skipAfterRatio: 0.5,
    /** Once per calendar day per device (app-side). Set false to show every open. */
    oncePerDay: true,
    items: [
      {
        id: 'gmax-promo-1',
        enabled: true,
        videoUrl:
          'https://screenapp.io/app/api/public/files/QHfvRAiS8M5REUJuo5WSSiig',
        title: 'GMAX — free music, no ads',
        linkUrl: 'https://github.com/gamxsharma305-png/gmax-android/releases',
        linkLabel: 'Latest APK / share',
      },
    ],
  },
};
