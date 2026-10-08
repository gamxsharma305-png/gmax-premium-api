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
    buildId: '8bd8dbe1-069c-4416-bb12-353d1cea1f51',
    apkUrl:
      'https://github.com/gamxsharma305-png/gmax-android/releases/download/1.2.8/application-8bd8dbe1-069c-4416-bb12-353d1cea1f51.apk',
    force: false,
    notes:
      'Latest stable — offline, search, theme. Install safe (display 1.2.4).',
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
