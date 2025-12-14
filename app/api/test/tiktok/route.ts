import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const handle = searchParams.get('handle')

  if (!handle) {
    return NextResponse.json(
      { error: 'Handle parameter is required' },
      { status: 400 }
    )
  }

  // Remove @ if present
  const cleanHandle = handle.replace('@', '')
  const url = `https://www.tiktok.com/@${cleanHandle}`

  try {
    // Fetch the TikTok profile page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch TikTok profile: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const html = await response.text()

    // Try to extract the account name from the HTML
    // TikTok stores account info in embedded JSON data
    
    // Method 1: Look for __UNIVERSAL_DATA_FOR_REHYDRATION__ or similar window data
    const windowDataMatch = html.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({[\s\S]*?});/)
    if (windowDataMatch) {
      try {
        const data = JSON.parse(windowDataMatch[1])
        // Navigate through TikTok's data structure
        if (data?.defaultScope?.webapp?.user?.userInfo?.user?.nickname) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: data.defaultScope.webapp.user.userInfo.user.nickname,
            url,
            method: 'window-data-nickname',
          })
        }
        if (data?.defaultScope?.webapp?.user?.userInfo?.user?.uniqueId) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: data.defaultScope.webapp.user.userInfo.user.uniqueId,
            url,
            method: 'window-data-uniqueId',
          })
        }
      } catch (e) {
        // Continue to other methods
      }
    }

    // Method 2: Look for <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
    const scriptDataMatch = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)
    if (scriptDataMatch) {
      try {
        const data = JSON.parse(scriptDataMatch[1])
        if (data?.defaultScope?.webapp?.user?.userInfo?.user?.nickname) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: data.defaultScope.webapp.user.userInfo.user.nickname,
            url,
            method: 'script-data-nickname',
          })
        }
        if (data?.defaultScope?.webapp?.user?.userInfo?.user?.uniqueId) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: data.defaultScope.webapp.user.userInfo.user.uniqueId,
            url,
            method: 'script-data-uniqueId',
          })
        }
      } catch (e) {
        // Continue to other methods
      }
    }

    // Method 3: Look for JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1])
        if (jsonLd.name && !jsonLd.name.includes('TikTok - Make Your Day')) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: jsonLd.name,
            url,
            method: 'json-ld',
          })
        }
      } catch (e) {
        // Continue to other methods
      }
    }

    // Method 4: Look for og:title and parse it
    const ogTitleMatch = html.match(/<meta property="og:title" content="(.*?)"/i)
    if (ogTitleMatch) {
      const ogTitle = ogTitleMatch[1]
      // TikTok og:title format is usually "Account Name (@handle) | TikTok"
      const nameMatch = ogTitle.match(/^([^(@]+)/)
      if (nameMatch && !ogTitle.includes('TikTok - Make Your Day')) {
        const accountName = nameMatch[1].trim()
        if (accountName && accountName.length > 0) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: accountName,
            url,
            method: 'og-title',
            fullTitle: ogTitle,
          })
        }
      }
    }

    // Method 5: Look for meta description which sometimes contains account info
    const metaDescMatch = html.match(/<meta name="description" content="(.*?)"/i)
    if (metaDescMatch) {
      const desc = metaDescMatch[1]
      // Sometimes description has format like "Account Name on TikTok | ..."
      const nameMatch = desc.match(/^([^|]+)/)
      if (nameMatch) {
        const accountName = nameMatch[1].replace(' on TikTok', '').trim()
        if (accountName && accountName.length > 0 && !accountName.includes('TikTok - Make Your Day')) {
          return NextResponse.json({
            handle: cleanHandle,
            accountName: accountName,
            url,
            method: 'meta-description',
          })
        }
      }
    }

    // Method 6: Look for any script tags with JSON data containing user info
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
    for (const match of scriptMatches) {
      const scriptContent = match[1]
      // Look for patterns like "nickname": "Account Name"
      const nicknameMatch = scriptContent.match(/"nickname"\s*:\s*"([^"]+)"/)
      if (nicknameMatch) {
        return NextResponse.json({
          handle: cleanHandle,
          accountName: nicknameMatch[1],
          url,
          method: 'script-nickname-regex',
        })
      }
      // Look for patterns like "uniqueId": "handle"
      const uniqueIdMatch = scriptContent.match(/"uniqueId"\s*:\s*"([^"]+)"/)
      if (uniqueIdMatch && uniqueIdMatch[1] !== cleanHandle) {
        // This might be the handle, not the name, but let's try
        return NextResponse.json({
          handle: cleanHandle,
          accountName: uniqueIdMatch[1],
          url,
          method: 'script-uniqueId-regex',
        })
      }
    }

    // If we can't find it, return the raw HTML snippet for debugging
    return NextResponse.json({
      handle: cleanHandle,
      accountName: null,
      url,
      error: 'Could not extract account name',
      htmlSnippet: html.substring(0, 2000), // First 2000 chars for debugging
    })

  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch TikTok profile',
        message: error.message,
        handle: cleanHandle,
        url,
      },
      { status: 500 }
    )
  }
}

