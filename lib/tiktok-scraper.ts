/**
 * Utility to fetch TikTok account name from a username/handle
 * @param username - The TikTok username (without @)
 * @returns The account display name or null if not found
 */
export async function getTikTokAccountName(username: string): Promise<string | null> {
  try {
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '')
    
    // Fetch the TikTok profile page
    const response = await fetch(`https://www.tiktok.com/@${cleanUsername}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch TikTok profile: ${response.status} ${response.statusText}`)
      return null
    }

    const html = await response.text()

    // TikTok stores user data in a script tag with id="__UNIVERSAL_DATA_FOR_REHYDRATION__"
    // or in window.__UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalDataMatch = html.match(/<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/)
    if (universalDataMatch) {
      try {
        const data = JSON.parse(universalDataMatch[1])
        // Navigate through the data structure to find user info
        const userInfo = data?.defaultScope?.webapp?.user?.userInfo || 
                        data?.__DEFAULT_SCOPE__?.webapp?.user?.userInfo ||
                        data?.webapp?.user?.userInfo
        
        if (userInfo?.nickname) {
          return userInfo.nickname.trim()
        }
        if (userInfo?.uniqueId && userInfo.uniqueId !== cleanUsername) {
          // Sometimes uniqueId is the display name
          return userInfo.uniqueId.trim()
        }
      } catch (e) {
        // Continue to other methods
      }
    }

    // Try to find the embedded JSON data in script tags
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
    for (const match of scriptMatches) {
      const scriptContent = match[1]
      // Look for user data patterns
      const patterns = [
        /"nickname"\s*:\s*"([^"]+)"/i,
        /"uniqueId"\s*:\s*"([^"]+)"[^}]*"nickname"\s*:\s*"([^"]+)"/i,
        /"userInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"/i,
        /"webapp"\s*:\s*\{[^}]*"user"\s*:\s*\{[^}]*"userInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"/i,
      ]
      
      for (const pattern of patterns) {
        const result = scriptContent.match(pattern)
        if (result) {
          // Return the last capture group (nickname)
          const nickname = result[result.length - 1]
          if (nickname && nickname !== cleanUsername && !nickname.includes('TikTok')) {
            return nickname.trim()
          }
        }
      }
    }

    // Try to extract from the HTML structure - look for the actual display name element
    // TikTok uses data-e2e attributes
    const namePatterns = [
      /<h1[^>]*data-e2e=["']user-title["'][^>]*>([^<]+)<\/h1>/i,
      /<h2[^>]*data-e2e=["']user-title["'][^>]*>([^<]+)<\/h2>/i,
      /<span[^>]*data-e2e=["']user-title["'][^>]*>([^<]+)<\/span>/i,
      /<div[^>]*data-e2e=["']user-title["'][^>]*>([^<]+)<\/div>/i,
    ]

    for (const pattern of namePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const name = match[1].trim()
        // Make sure it's not the username or title
        if (name !== cleanUsername && !name.includes('TikTok') && !name.includes('|')) {
          return name
        }
      }
    }

    // Last resort: try to extract from meta tags, but be more careful
    const metaNameMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    if (metaNameMatch) {
      const title = metaNameMatch[1]
      // TikTok titles are usually "Name (@username) | TikTok"
      // Extract the name part before the (@username)
      const nameMatch = title.match(/^([^(]+?)(?:\s*\(@[^)]+\))?\s*\|/i)
      if (nameMatch) {
        const name = nameMatch[1].trim()
        // Verify it's not just the username
        if (name !== cleanUsername && name.length > 0) {
          return name
        }
      }
    }

    console.warn(`Could not extract TikTok account name for @${cleanUsername}`)
    return null
  } catch (error) {
    console.error(`Error fetching TikTok account name for @${username}:`, error)
    return null
  }
}

