/**
 * Utility to map social platform names to their icon image paths.
 * 
 * Store platform icons in: public/assets/social/
 * 
 * Expected files:
 * - tiktok.png (or .svg)
 * - instagram.png (or .svg)
 * - snapchat.png (or .svg)
 */

export function getSocialPlatformImage(platform: string): string {
  const platformMap: Record<string, string> = {
    TikTok: '/assets/social/TikTok.webp',
    Instagram: '/assets/social/Instagram.webp',
    Snapchat: '/assets/social/Snapchat.png',
  }

  return platformMap[platform] || '/assets/social/default.png'
}

