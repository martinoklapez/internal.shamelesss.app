/**
 * Game Image Mapping
 * 
 * Store game images in: public/assets/games/
 * 
 * Expected filenames:
 * - date-roulette.png (or .jpg, .svg)
 * - most-likely-to.png
 * - never-have-i-ever.png
 * - role-play-generator.png
 * - scratch-dates.png
 * - would-you-rather.png
 * 
 * You can also use:
 * - date-roulette-icon.svg
 * - date-roulette-image.jpg
 * etc.
 */

export function getGameImagePath(gameId: string): string {
  const imageMap: Record<string, string> = {
    'date-roulette': '/assets/games/date-roulette.png',
    'most-likely-to': '/assets/games/most-likely-to.png',
    'never-have-i-ever': '/assets/games/never-have-i-ever.png',
    'role-play-generator': '/assets/games/roleplay-generator.png',
    'scratch-dates': '/assets/games/scratch-dates.png',
    'would-you-rather': '/assets/games/would-you-rather.png',
  }

  return imageMap[gameId] || '/assets/games/default.png'
}

