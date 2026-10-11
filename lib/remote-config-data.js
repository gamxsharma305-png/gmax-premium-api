/**
 * GMAX remote config — EDIT THIS FILE + redeploy Vercel.
 * No APK rebuild needed for update popup, home ads, or how-to video.
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
    buildId: 'edgeone-site',
    apkUrl: 'https://gmaxmusify.edgeone.dev/',
    force: false,
    notes: 'Naya update available. Site se latest APK install karo.',
  },

  /**
   * Paywall guides — change YouTube link anytime, no APK rebuild.
   * Use youtube.com/embed/VIDEO_ID or full watch URL.
   */
  guides: {
    howToGenerateKeyYoutubeUrl:
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
  },

  ads: {
    enabled: true,
    delaySeconds: 10,
    maxAds: 2,
    skipAfterRatio: 0.5,
    oncePerDay: true,
    items: [
      {
        id: 'gmax-promo-1',
        enabled: true,
        videoUrl:
          'https://screenapp.io/app/api/public/files/QHfvRAiS8M5REUJuo5WSSiig',
        brandName: 'GMAX',
        storeLabel: 'Music app',
        subtitle: 'Free music, offline download — GMAX try karo!',
        linkUrl: 'https://gmaxmusify.edgeone.dev/',
        linkLabel: 'Install',
      },
    ],
  },
};
