/**
 * Utility to fetch Instagram account name from a username/handle
 * @param username - The Instagram username (without @)
 * @returns The account display name or null if not found
 */
export async function getInstagramAccountName(username: string): Promise<string | null> {
  try {
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '')
    
    // Fetch the Instagram profile page
    const response = await fetch(`https://www.instagram.com/${cleanUsername}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch Instagram profile: ${response.status} ${response.statusText} for ${cleanUsername}`)
      return null
    }

    const html = await response.text()

    // 1. Try to extract from JSON-LD structured data
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        // Instagram uses @type: "Person" or "ProfilePage"
        if (data['@type'] === 'Person' || data['@type'] === 'ProfilePage') {
          if (data.name && data.name !== cleanUsername && !data.name.toLowerCase().includes('instagram')) {
            return data.name.trim()
          }
          if (data.alternateName && data.alternateName !== cleanUsername) {
            // Sometimes the display name is in alternateName
            return data.alternateName.trim()
          }
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }

    // 2. Try to extract from window._sharedData or similar embedded JSON
    const sharedDataMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*({[\s\S]*?});<\/script>/)
    if (sharedDataMatch) {
      try {
        const data = JSON.parse(sharedDataMatch[1])
        const userInfo = data?.entry_data?.ProfilePage?.[0]?.graphql?.user ||
                        data?.entry_data?.profilePage?.[0]?.graphql?.user
        
        if (userInfo?.full_name) {
          const fullName = userInfo.full_name.trim()
          if (fullName && fullName !== cleanUsername && !fullName.toLowerCase().includes('instagram')) {
            return fullName
          }
        }
      } catch (e) {
        // Continue to other methods
      }
    }

    // 3. Try to extract from other script tags containing user data
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
    for (const match of scriptMatches) {
      const scriptContent = match[1]
      // Look for full_name or display name patterns
      const patterns = [
        /"full_name"\s*:\s*"([^"]+)"/i,
        /"fullName"\s*:\s*"([^"]+)"/i,
        /"displayName"\s*:\s*"([^"]+)"/i,
        /"name"\s*:\s*"([^"]+)"[^}]*"username"\s*:\s*"([^"]+)"/i,
      ]
      
      for (const pattern of patterns) {
        const result = scriptContent.match(pattern)
        if (result) {
          const name = result[1] || result[result.length - 1]
          if (name && name !== cleanUsername && !name.toLowerCase().includes('instagram') && !name.includes('|')) {
            return name.trim()
          }
        }
      }
    }

    // 4. Try to extract from meta tags (og:title)
    // Instagram og:title format: "Name (@username) • Instagram photos and videos"
    const metaTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    if (metaTitleMatch) {
      const title = metaTitleMatch[1]
      // Extract name before the (@username) part
      const nameMatch = title.match(/^([^(]+?)(?:\s*\(@[^)]+\))?\s*[•|]/i)
      if (nameMatch) {
        const name = nameMatch[1].trim()
        if (name && name !== cleanUsername && !name.toLowerCase().includes('instagram') && !name.includes('|')) {
          return name
        }
      }
    }

    // 5. Try to extract from og:description
    const metaDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    if (metaDescMatch) {
      const description = metaDescMatch[1]
      // Sometimes description contains "Name (@username) - Description"
      const nameMatch = description.match(/^([^(]+?)(?:\s*\(@[^)]+\))?\s*-/i)
      if (nameMatch) {
        const name = nameMatch[1].trim()
        if (name && name !== cleanUsername && !name.toLowerCase().includes('instagram')) {
          return name
        }
      }
    }

    // 6. Try to extract from HTML structure - look for h1 or title elements
    const htmlPatterns = [
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]

    for (const pattern of htmlPatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const text = match[1].trim()
        // Extract name before (@username) or • or |
        const nameMatch = text.match(/^([^(•|]+?)(?:\s*\(@[^)]+\))?\s*[•|]/i)
        if (nameMatch) {
          const name = nameMatch[1].trim()
          if (name && name !== cleanUsername && !name.toLowerCase().includes('instagram')) {
            return name
          }
        }
      }
    }

    console.warn(`Could not extract Instagram account name for @${cleanUsername} using any method.`)
    return null
  } catch (error) {
    console.error(`Error fetching Instagram account name for @${username}:`, error)
    return null
  }
}

