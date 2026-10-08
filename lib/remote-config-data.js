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
    enabled: false,
    delaySeconds: 10,
    maxAds: 2,
    skipAfterRatio: 0.5,
    /** Once per calendar day per device (app-side). Set false to show every open. */
    oncePerDay: true,
    items: [
      // Example — enable + fill URLs when influencer gives assets:
      // {
      //   id: 'reel-1',
      //   enabled: true,
      //   videoUrl: 'https://cdn.example.com/ad1.mp4',
      //   posterUrl: 'https://cdn.example.com/ad1.jpg',
      //   title: 'Brand Reel',
      //   linkUrl: 'https://www.instagram.com/reel/XXXX/',
      //   linkLabel: 'Instagram pe dekho',
      // },
      // {
      //   id: 'reel-2',
      //   enabled: true,
      //   videoUrl: 'https://cdn.example.com/ad2.mp4',
      //   posterUrl: 'https://cdn.example.com/ad2.jpg',
      //   title: 'Second Ad',
      //   linkUrl: 'https://www.instagram.com/reel/YYYY/',
      //   linkLabel: 'Open link',
      // },
    ],
  },
};
