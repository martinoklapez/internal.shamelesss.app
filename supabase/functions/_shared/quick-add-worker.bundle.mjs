// lib/runtime/env.ts
function readRuntimeEnv(name) {
  const deno = globalThis.Deno;
  if (deno?.env) {
    const v = deno.env.get(name);
    if (v?.trim()) return v.trim();
  }
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[name];
    if (v?.trim()) return v.trim();
  }
  return void 0;
}

// lib/apify/client.ts
var APIFY_API_BASE = "https://api.apify.com/v2";
function getApifyApiToken() {
  return readRuntimeEnv("APIFY_API_TOKEN");
}
function apifyActorIdToPath(actorId) {
  return actorId.includes("/") ? actorId.replace("/", "~") : actorId;
}
async function runApifyActorSyncGetDatasetItems(actorId, input, options) {
  const token = getApifyApiToken();
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }
  const path = apifyActorIdToPath(actorId);
  const timeoutMs = options?.timeoutMs ?? 12e4;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${APIFY_API_BASE}/acts/${path}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Apify actor ${actorId} failed (${response.status}): ${body.slice(0, 500)}`
      );
    }
    const items = await response.json();
    return Array.isArray(items) ? items : [];
  } finally {
    clearTimeout(timeout);
  }
}

// lib/extract-emails-from-text.ts
var EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
var BLOCKED_LOCAL_PARTS = /* @__PURE__ */ new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster"
]);
var BLOCKED_DOMAINS = /* @__PURE__ */ new Set([
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "example.com",
  "test.com",
  "email.com",
  "domain.com",
  "sentry.io"
]);
function isPlausibleContactEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain || domain.includes("..")) return false;
  if (BLOCKED_LOCAL_PARTS.has(local)) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(domain)) return false;
  return true;
}
function extractEmailsFromText(text) {
  if (!text.trim()) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const match of text.matchAll(EMAIL_RE)) {
    const raw = match[0].replace(/\.$/, "");
    const email = normalizeEmail(raw);
    if (!isPlausibleContactEmail(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

// lib/normalize-follower-count.ts
function normalizeFollowerCount(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  }
  return null;
}

// lib/apify/tiktok-profile.ts
var DEFAULT_TIKTOK_PROFILE_ACTOR = "clockworks/tiktok-profile-scraper";
var DEFAULT_TIKTOK_SCRAPER_ACTOR = "clockworks/tiktok-scraper";
function tiktokProfileActorId() {
  return readRuntimeEnv("APIFY_TIKTOK_PROFILE_ACTOR_ID") || DEFAULT_TIKTOK_PROFILE_ACTOR;
}
function tiktokScraperActorId() {
  return readRuntimeEnv("APIFY_TIKTOK_SCRAPER_ACTOR_ID") || DEFAULT_TIKTOK_SCRAPER_ACTOR;
}
var TIKTOK_DOWNLOAD_FLAGS = {
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSlideshowImages: false,
  shouldDownloadSubtitles: false,
  shouldDownloadAvatars: false,
  shouldDownloadMusicCovers: false
};
function normalizeHandle(handle) {
  return handle.replace(/^@/, "").trim();
}
function handleMatches(meta, handle) {
  const key = handle.toLowerCase();
  const name = meta.name?.trim().toLowerCase();
  const nick = meta.nickName?.trim().toLowerCase();
  return name === key || nick === key;
}
function emailFromTikTokBioLink(bioLink) {
  if (!bioLink?.trim()) return null;
  const trimmed = bioLink.trim();
  if (trimmed.toLowerCase().startsWith("mailto:")) {
    const addr = trimmed.slice(7).split("?")[0]?.trim();
    return addr && addr.includes("@") ? addr.toLowerCase() : null;
  }
  return extractEmailsFromText(trimmed)[0] ?? null;
}
function pickTikTokApifyItem(items, handle) {
  const valid = items.filter((item) => !item.errorCode && !item.error && item.authorMeta);
  if (valid.length === 0) return void 0;
  const key = handle.toLowerCase();
  return valid.find((item) => item.authorMeta && handleMatches(item.authorMeta, key)) ?? valid[0];
}
function mapTikTokAuthorMetaToProfile(meta, fallbackHandle) {
  const username = (meta.name ?? fallbackHandle).trim();
  const display = (meta.nickName ?? meta.name ?? fallbackHandle).trim();
  const profilePicture = meta.avatar?.trim() || meta.originalAvatarUrl?.trim() || null;
  const biography = meta.signature?.trim() || meta.bio?.trim() || null;
  const businessEmail = emailFromTikTokBioLink(meta.bioLink);
  return {
    username,
    name: display && display !== username ? display : username,
    profilePicture,
    followerCount: normalizeFollowerCount(
      meta.fans ?? meta.followerCount ?? meta.followers
    ),
    biography,
    businessEmail,
    publicEmail: null
  };
}
function profileScrapeInput(handle) {
  return {
    profiles: [handle],
    resultsPerPage: 1,
    ...TIKTOK_DOWNLOAD_FLAGS
  };
}
function scraperProfileInput(handle) {
  return {
    profiles: [handle],
    resultsPerPage: 1,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: false,
    ...TIKTOK_DOWNLOAD_FLAGS
  };
}
async function runTikTokActor(actorId, input, handle) {
  const items = await runApifyActorSyncGetDatasetItems(actorId, input);
  const row = pickTikTokApifyItem(items, handle);
  if (!row) {
    const err = items.find((item) => item.errorCode || item.error);
    if (err) {
      console.warn(
        `Apify TikTok (${actorId}) for @${handle}:`,
        err.errorCode ?? err.error ?? "no results"
      );
    }
    return null;
  }
  const meta = row.authorMeta;
  if (!meta) return null;
  return mapTikTokAuthorMetaToProfile(meta, handle);
}
async function getTikTokProfileViaApify(handle) {
  const profile = normalizeHandle(handle);
  if (!profile) return null;
  const profileActor = tiktokProfileActorId();
  try {
    const fromProfileActor = await runTikTokActor(profileActor, profileScrapeInput(profile), profile);
    if (fromProfileActor) return fromProfileActor;
  } catch (error) {
    console.warn(`Apify TikTok profile actor failed for @${profile}:`, error);
  }
  const scraperActor = tiktokScraperActorId();
  if (scraperActor === profileActor) return null;
  try {
    return await runTikTokActor(scraperActor, scraperProfileInput(profile), profile);
  } catch (error) {
    console.warn(`Apify TikTok scraper actor failed for @${profile}:`, error);
    return null;
  }
}

// lib/apify/social-profile.ts
var DEFAULT_INSTAGRAM_ACTOR = "apify/instagram-profile-scraper";
function instagramActorId() {
  return readRuntimeEnv("APIFY_INSTAGRAM_PROFILE_ACTOR_ID") || DEFAULT_INSTAGRAM_ACTOR;
}
function isApifySocialProfileConfigured() {
  return Boolean(getApifyApiToken());
}
function normalizeHandle2(handle) {
  return handle.replace(/^@/, "").trim();
}
async function getInstagramProfileViaApify(handle) {
  const username = normalizeHandle2(handle);
  if (!username) return null;
  const items = await runApifyActorSyncGetDatasetItems(
    instagramActorId(),
    {
      usernames: [username],
      includeAboutSection: true
    }
  );
  const row = items.find((item) => item.username?.toLowerCase() === username.toLowerCase()) ?? items.find((item) => !item.error) ?? items[0];
  if (!row || row.error) {
    console.warn(
      `Apify Instagram profile scrape failed for @${username}:`,
      row?.error ?? row?.errorDescription ?? "no results"
    );
    return null;
  }
  const scrapedUsername = row.username?.trim() || username;
  const fullName = row.fullName?.trim();
  const profilePicture = row.profilePicUrlHD ?? row.profilePicUrl ?? null;
  const biography = row.biography?.trim() || row.bio?.trim() || null;
  const businessEmail = row.businessEmail?.trim() || row.business_email?.trim() || row.email?.trim() || null;
  const publicEmail = row.publicEmail?.trim() || row.public_email?.trim() || null;
  const followerCount = normalizeFollowerCount(
    row.followersCount ?? row.followerCount ?? row.followers_count
  );
  return {
    username: scrapedUsername,
    name: fullName && fullName !== scrapedUsername ? fullName : scrapedUsername,
    profilePicture,
    followerCount,
    biography,
    businessEmail,
    publicEmail
  };
}

// lib/instagram-scraper.ts
var INSTAGRAM_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
function unescapeInstagramJsonString(raw) {
  return raw.replace(/\\u0026/g, "&").replace(/\\u0040/g, "@").replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	").replace(/\\"/g, '"').trim();
}
function extractInstagramJsonString(html, field) {
  const match = html.match(new RegExp(`"${field}":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`));
  if (!match?.[1]) return null;
  const value = unescapeInstagramJsonString(match[1]);
  return value || null;
}
function extractInstagramJsonNumber(html, field) {
  const match = html.match(new RegExp(`"${field}":(\\d+)`));
  if (!match?.[1]) return null;
  return normalizeFollowerCount(Number(match[1]));
}
function extractInstagramFollowerCount(html) {
  return extractInstagramJsonNumber(html, "followersCount") ?? extractInstagramJsonNumber(html, "followerCount") ?? extractInstagramJsonNumber(html, "followers_count");
}
function decodeHtmlEntities(text) {
  return text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#064;/g, "@");
}
function parseInstagramHandle(input) {
  const trimmed = input.trim().replace(/^@/, "");
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const { pathname } = new URL(trimmed);
      const segments = pathname.split("/").filter(Boolean);
      const blocked = /* @__PURE__ */ new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);
      if (segments.length > 0 && !blocked.has(segments[0])) {
        return segments[0].replace(/^@/, "");
      }
    }
  } catch {
  }
  return trimmed.split("/").filter(Boolean).pop()?.replace(/^@/, "") ?? trimmed;
}
function parseInstagramProfileFromHtml(html, fallbackHandle) {
  const metaContent = (property) => {
    const match = html.match(
      new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
        "i"
      )
    );
    return match?.[1] ? decodeHtmlEntities(match[1]) : null;
  };
  const ogTitle = metaContent("og:title");
  const ogImage = metaContent("og:image");
  let name = null;
  let username = fallbackHandle;
  if (ogTitle) {
    const titleMatch = ogTitle.match(/^([^(•]+?)(?:\s*\(@([^)]+)\))?\s*[•|]/i);
    if (titleMatch) {
      name = titleMatch[1].trim();
      if (titleMatch[2]) username = titleMatch[2].replace(/^@/, "").trim();
    }
  }
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g
  );
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "Person" || data["@type"] === "ProfilePage") {
        if (data.name && !String(data.name).toLowerCase().includes("instagram")) {
          name = String(data.name).trim();
        }
        if (data.image) {
          const img = typeof data.image === "string" ? data.image : Array.isArray(data.image) ? data.image[0] : data.image?.url;
          if (img && !ogImage) {
            return {
              username,
              name: name ?? username,
              profilePicture: String(img),
              followerCount: extractInstagramFollowerCount(html)
            };
          }
        }
      }
    } catch {
    }
  }
  const picMatch = html.match(/"profile_pic_url_hd":"([^"\\]+(?:\\.[^"\\]*)*)"/) ?? html.match(/"profile_pic_url":"([^"\\]+(?:\\.[^"\\]*)*)"/);
  const profilePicture = ogImage ?? picMatch?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/") ?? null;
  const fullNameMatch = html.match(/"full_name":"([^"\\]+(?:\\.[^"\\]*)*)"/);
  if (fullNameMatch && !name) {
    name = fullNameMatch[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/").trim();
  }
  const usernameMatch = html.match(/"username":"([^"\\]+)"/);
  if (usernameMatch) username = usernameMatch[1];
  const biography = extractInstagramJsonString(html, "biography");
  const businessEmail = extractInstagramJsonString(html, "business_email") ?? extractInstagramJsonString(html, "businessEmail");
  const publicEmail = extractInstagramJsonString(html, "public_email") ?? extractInstagramJsonString(html, "publicEmail");
  const followerCount = extractInstagramFollowerCount(html);
  if (!name && !profilePicture && username === fallbackHandle && !biography && followerCount == null) {
    return null;
  }
  return {
    username,
    name: name && name !== username ? name : username,
    profilePicture,
    followerCount,
    biography,
    businessEmail,
    publicEmail
  };
}
async function fetchInstagramProfileHtml(username) {
  const urls = [
    `https://www.instagram.com/${username}/`,
    `https://www.instagram.com/${username}/?hl=en`
  ];
  const headers = {
    ...INSTAGRAM_FETCH_HEADERS,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
  for (const url of urls) {
    const response = await fetch(url, { headers });
    if (!response.ok) continue;
    const html = await response.text();
    if (parseInstagramProfileFromHtml(html, username)) return html;
  }
  return null;
}
async function getInstagramProfile(usernameOrUrl) {
  try {
    const cleanUsername = parseInstagramHandle(usernameOrUrl);
    const html = await fetchInstagramProfileHtml(cleanUsername);
    if (!html) {
      console.warn(`Could not extract Instagram profile for @${cleanUsername}`);
      return null;
    }
    return parseInstagramProfileFromHtml(html, cleanUsername);
  } catch (error) {
    console.error(`Error fetching Instagram profile for ${usernameOrUrl}:`, error);
    return null;
  }
}

// lib/tiktok-scraper.ts
var TIKTOK_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
function parseTikTokHandle(input) {
  const trimmed = input.trim().replace(/^@/, "");
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const path = new URL(trimmed).pathname;
      const match = path.match(/^\/@([^/?#]+)/);
      if (match) return match[1];
    }
  } catch {
  }
  return trimmed.split("/").pop()?.replace(/^@/, "") ?? trimmed;
}
function followerCountFromTikTokUser(user) {
  return normalizeFollowerCount(
    user.followerCount ?? user.fans ?? user.stats?.followerCount ?? user.stats?.follower ?? user.stats?.fans
  );
}
function extractTikTokFollowerCountFromHtml(html) {
  const match = html.match(/"followerCount"\s*:\s*(\d+)/) ?? html.match(/"fans"\s*:\s*(\d+)/);
  if (!match?.[1]) return null;
  return normalizeFollowerCount(Number(match[1]));
}
function extractUserFromUniversalData(data) {
  const scope = data.__DEFAULT_SCOPE__ ?? data.defaultScope;
  if (!scope) return null;
  const detail = scope["webapp.user-detail"] ?? scope.webapp?.["user-detail"];
  const userInfo = detail?.userInfo;
  const user = userInfo?.user ?? userInfo;
  if (user?.uniqueId || user?.nickname) return user;
  const legacy = scope.webapp?.user;
  const legacyInfo = legacy?.userInfo;
  const legacyUser = legacyInfo?.user ?? legacyInfo;
  return legacyUser?.uniqueId || legacyUser?.nickname ? legacyUser : null;
}
function parseTikTokProfileFromHtml(html, fallbackHandle) {
  const universalDataMatch = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/
  );
  if (universalDataMatch) {
    try {
      const data = JSON.parse(universalDataMatch[1]);
      const user = extractUserFromUniversalData(data);
      if (user) {
        return {
          username: (user.uniqueId ?? fallbackHandle).trim(),
          name: (user.nickname ?? user.uniqueId ?? fallbackHandle).trim(),
          profilePicture: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? null,
          followerCount: followerCountFromTikTokUser(user),
          biography: user.signature?.trim() || null
        };
      }
    } catch {
    }
  }
  const nicknameMatch = html.match(/"uniqueId"\s*:\s*"([^"]+)"[\s\S]*?"nickname"\s*:\s*"([^"]+)"/);
  if (nicknameMatch) {
    const avatarMatch = html.match(
      /"avatarLarger"\s*:\s*"(https:[^"\\]+(?:\\.[^"\\]*)*)"/
    );
    return {
      username: nicknameMatch[1].trim(),
      name: nicknameMatch[2].trim(),
      profilePicture: avatarMatch?.[1]?.replace(/\\u002F/g, "/") ?? null,
      followerCount: extractTikTokFollowerCountFromHtml(html)
    };
  }
  const metaNameMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaNameMatch) {
    const title = metaNameMatch[1];
    const nameMatch = title.match(/^([^(]+?)(?:\s*\(@[^)]+\))?\s*\|/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== fallbackHandle) {
        return {
          username: fallbackHandle,
          name,
          profilePicture: null,
          followerCount: extractTikTokFollowerCountFromHtml(html)
        };
      }
    }
  }
  return null;
}
async function getTikTokProfile(usernameOrUrl) {
  try {
    const cleanUsername = parseTikTokHandle(usernameOrUrl);
    const response = await fetch(`https://www.tiktok.com/@${cleanUsername}`, {
      headers: TIKTOK_FETCH_HEADERS
    });
    if (!response.ok) {
      console.error(
        `Failed to fetch TikTok profile: ${response.status} ${response.statusText}`
      );
      return null;
    }
    const html = await response.text();
    const profile = parseTikTokProfileFromHtml(html, cleanUsername);
    if (!profile) {
      console.warn(`Could not extract TikTok profile for @${cleanUsername}`);
    }
    return profile;
  } catch (error) {
    console.error(`Error fetching TikTok profile for ${usernameOrUrl}:`, error);
    return null;
  }
}

// lib/social-profile-draft-contact.ts
function normalizeEmail2(email) {
  return email.trim().toLowerCase();
}
function pickEmail(businessEmail, publicEmail, biography) {
  const business = businessEmail?.trim();
  if (business) {
    const normalized = normalizeEmail2(business);
    if (normalized.includes("@")) {
      return { email: normalized, source: "business_email" };
    }
  }
  const pub = publicEmail?.trim();
  if (pub) {
    const normalized = normalizeEmail2(pub);
    if (normalized.includes("@")) {
      return { email: normalized, source: "public_email" };
    }
  }
  const fromBio = extractEmailsFromText(biography ?? "")[0];
  if (fromBio) {
    return { email: fromBio, source: "bio" };
  }
  return null;
}
function buildDraftContactFromProfileMeta(opts) {
  const picked = pickEmail(opts.businessEmail, opts.publicEmail, opts.biography);
  if (!picked) return null;
  const name = opts.displayName.trim() || opts.handle.trim();
  if (!name) return null;
  return {
    email: picked.email,
    name,
    source: picked.source,
    biography: opts.biography?.trim() || null
  };
}

// lib/social-profile-url.ts
function parseSocialProfileUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname;
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const match = path.match(/^\/@([^/?#]+)/);
      if (match) {
        const handle = match[1];
        return {
          platform: "tiktok",
          handle,
          profileUrl: `https://www.tiktok.com/@${handle}`
        };
      }
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const segments = path.split("/").filter(Boolean);
      const blocked = /* @__PURE__ */ new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);
      if (segments.length > 0 && !blocked.has(segments[0])) {
        const handle = segments[0].replace(/^@/, "");
        return {
          platform: "instagram",
          handle,
          profileUrl: `https://www.instagram.com/${handle}/`
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}
async function fetchSocialProfileMetadata(platform, profileUrl, handle) {
  if (isApifySocialProfileConfigured()) {
    try {
      const viaApify = platform === "tiktok" ? await getTikTokProfileViaApify(handle) : await getInstagramProfileViaApify(handle);
      if (viaApify) return viaApify;
    } catch (error) {
      console.warn(
        `Apify ${platform} profile scrape failed for @${handle}, using direct fetch`,
        error
      );
    }
  }
  return platform === "tiktok" ? await getTikTokProfile(profileUrl) : await getInstagramProfile(profileUrl);
}
async function resolveSocialProfileFromUrl(input) {
  const parsed = parseSocialProfileUrl(input);
  if (!parsed) return null;
  const fetched = await fetchSocialProfileMetadata(
    parsed.platform,
    parsed.profileUrl,
    parsed.handle
  );
  const username = fetched?.username ?? parsed.handle;
  const name = fetched?.name ?? parsed.handle;
  const profilePicture = fetched?.profilePicture ?? null;
  const followerCount = fetched?.followerCount ?? null;
  const biography = fetched?.biography ?? null;
  const draftContact = buildDraftContactFromProfileMeta({
    platform: parsed.platform,
    displayName: name,
    handle: username,
    biography,
    businessEmail: fetched?.businessEmail,
    publicEmail: fetched?.publicEmail
  });
  return {
    platform: parsed.platform,
    username,
    name,
    profilePicture,
    followerCount,
    profileUrl: parsed.profileUrl,
    biography,
    draftContact
  };
}

// lib/creator-pipeline/constants.ts
var CREATOR_PIPELINE_SCHEMA = "creator_pipeline";

// lib/database/creator-pipeline/client.ts
function creatorPipelineDb(supabase) {
  return supabase.schema(CREATOR_PIPELINE_SCHEMA);
}

// lib/creator-outreach/store.ts
function normalizeEmail3(email) {
  return email.trim().toLowerCase();
}
function platformLabel(platform) {
  return platform === "tiktok" ? "TikTok" : "Instagram";
}

// lib/creator-outreach/quick-add.ts
var OTHER_PLATFORM = {
  instagram: "tiktok",
  tiktok: "instagram"
};
function normalizeHandle3(handle) {
  return handle.trim().replace(/^@/, "").toLowerCase();
}
function findProfileByPlatformHandle(store, platform, handle) {
  return findProfileByHandleOnPlatform(store, platform, handle);
}
function findProfileByHandleOnPlatform(store, platform, handle) {
  const key = normalizeHandle3(handle);
  return store.profiles.find(
    (p) => p.platform === platform && normalizeHandle3(p.handle) === key
  );
}
function findCrossPlatformProfileByHandle(store, platform, handle) {
  return findProfileByHandleOnPlatform(store, OTHER_PLATFORM[platform], handle);
}
function findCreatorForCrossPlatformHandle(store, platform, handle) {
  const sibling = findCrossPlatformProfileByHandle(store, platform, handle);
  if (!sibling?.creatorId) return null;
  const creator = store.creators.find((c) => c.id === sibling.creatorId);
  if (!creator) return null;
  return { creator, sibling };
}
function findContactsByEmail(store, email) {
  const normalized = normalizeEmail3(email);
  if (!normalized.includes("@")) return [];
  return store.contacts.filter((c) => c.email && normalizeEmail3(c.email) === normalized);
}
function pickContactForQuickAdd(matches, preferredCreatorId) {
  if (matches.length === 0) return void 0;
  if (preferredCreatorId) {
    const onCreator = matches.find((c) => c.creatorId === preferredCreatorId);
    if (onCreator) return onCreator;
  }
  const linked = matches.find((c) => c.creatorId);
  if (linked) return linked;
  return matches[0];
}
function findCreatorByDisplayName(store, displayName) {
  const key = displayName.trim().toLowerCase();
  if (!key) return void 0;
  return store.creators.find((c) => c.displayName.trim().toLowerCase() === key);
}
function planQuickAdd(store, input) {
  const handle = normalizeHandle3(input.handle);
  const displayName = input.displayName.trim() || handle;
  const existingProfile = findProfileByPlatformHandle(store, input.platform, handle);
  const profilePlan = existingProfile ? { action: "existing", profile: existingProfile } : { action: "create" };
  const crossPlatformSibling = findCrossPlatformProfileByHandle(
    store,
    input.platform,
    handle
  );
  const preferredCreatorId = existingProfile?.creatorId ?? crossPlatformSibling?.creatorId ?? null;
  let contactPlan = { action: "skip", reason: "no_email" };
  const email = input.draftContact?.email?.trim();
  if (email) {
    const matches = findContactsByEmail(store, email);
    const picked = pickContactForQuickAdd(matches, preferredCreatorId);
    if (picked) {
      contactPlan = { action: "link", contact: picked };
    } else if (input.draftContact) {
      contactPlan = { action: "create", draft: input.draftContact };
    }
  }
  let creatorPlan;
  if (existingProfile?.creatorId) {
    const creator = store.creators.find((c) => c.id === existingProfile.creatorId);
    if (creator) {
      creatorPlan = {
        action: "link",
        creator,
        reason: "Profile already linked to this creator"
      };
    } else {
      creatorPlan = { action: "create", displayName };
    }
  } else if (contactPlan.action === "link" && contactPlan.contact.creatorId) {
    const creator = store.creators.find((c) => c.id === contactPlan.contact.creatorId);
    if (creator) {
      creatorPlan = {
        action: "link",
        creator,
        reason: "Contact with this email is already on this creator"
      };
    } else {
      creatorPlan = { action: "create", displayName };
    }
  } else {
    const crossPlatform = findCreatorForCrossPlatformHandle(
      store,
      input.platform,
      handle
    );
    if (crossPlatform) {
      const { creator, sibling } = crossPlatform;
      creatorPlan = {
        action: "link",
        creator,
        reason: `Same @${handle} on ${platformLabel(sibling.platform)} (${sibling.handle})`
      };
    } else {
      const byName = findCreatorByDisplayName(store, displayName);
      if (byName) {
        creatorPlan = {
          action: "link",
          creator: byName,
          reason: "Creator with matching display name"
        };
      } else {
        creatorPlan = { action: "create", displayName };
      }
    }
  }
  return { profile: profilePlan, contact: contactPlan, creator: creatorPlan };
}

// lib/creator-outreach/quick-add-integrity.ts
var SHADOW_PREFIX = "queue-shadow:";
function quickAddJobRowToPeer(row) {
  return {
    jobId: row.id,
    status: row.status,
    url: row.url,
    urlNormalized: row.url_normalized,
    createdAt: row.created_at,
    resolved: row.resolved_payload ?? null,
    plan: row.plan_payload ?? null
  };
}
function peerPlatformHandle(peer) {
  if (peer.resolved) {
    return {
      platform: peer.resolved.platform,
      handle: normalizeHandle3(peer.resolved.username)
    };
  }
  const parts = peer.urlNormalized.split(":");
  if (parts.length !== 2) {
    const parsed = parseSocialProfileUrl(peer.url);
    if (!parsed) return null;
    return { platform: parsed.platform, handle: normalizeHandle3(parsed.handle) };
  }
  const platform = parts[0];
  if (platform !== "instagram" && platform !== "tiktok") return null;
  return { platform, handle: normalizeHandle3(parts[1]) };
}
function shadowCreatorId(jobId) {
  return `${SHADOW_PREFIX}creator:${jobId}`;
}
function shadowProfileId(jobId) {
  return `${SHADOW_PREFIX}profile:${jobId}`;
}
function shadowContactId(jobId) {
  return `${SHADOW_PREFIX}contact:${jobId}`;
}
function buildPlanningStoreWithQueue(store, peers, forJobId) {
  const next = structuredClone(store);
  const ordered = [...peers].filter((p) => p.jobId !== forJobId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const peer of ordered) {
    if (!["pending", "scraping", "ready", "confirming"].includes(peer.status)) continue;
    const ph = peerPlatformHandle(peer);
    if (!ph) continue;
    const plan = peer.plan ?? (peer.resolved ? planQuickAdd(next, {
      platform: peer.resolved.platform,
      handle: peer.resolved.username,
      displayName: peer.resolved.name.trim() || peer.resolved.username,
      draftContact: peer.resolved.draftContact
    }) : null);
    const existing = findProfileByPlatformHandle(next, ph.platform, ph.handle);
    const crossSibling = findCrossPlatformProfileByHandle(next, ph.platform, ph.handle);
    if (!existing && (!plan || plan.profile.action === "create")) {
      const displayName = peer.resolved?.name.trim() || peer.resolved?.username || ph.handle;
      const profile2 = {
        id: shadowProfileId(peer.jobId),
        platform: ph.platform,
        handle: ph.handle,
        displayName,
        profileUrl: peer.resolved?.profileUrl ?? peer.url,
        avatarUrl: null,
        followerCount: peer.resolved?.followerCount ?? null,
        creatorId: null,
        notes: "",
        scoutedAt: peer.createdAt,
        scoutedBy: ""
      };
      next.profiles.push(profile2);
    }
    if (!plan) continue;
    let creatorId = null;
    if (plan.creator.action === "link") {
      creatorId = plan.creator.creator.id;
    } else {
      const cid = shadowCreatorId(peer.jobId);
      if (!next.creators.some((c) => c.id === cid)) {
        const creator = {
          id: cid,
          displayName: plan.creator.displayName,
          status: "new",
          notes: "",
          avatarProfileId: null,
          createdAt: peer.createdAt,
          updatedAt: peer.createdAt
        };
        next.creators.push(creator);
      }
      creatorId = cid;
    }
    const profile = plan.profile.action === "existing" ? plan.profile.profile : findProfileByPlatformHandle(next, ph.platform, ph.handle);
    if (profile && creatorId && !profile.creatorId) {
      profile.creatorId = creatorId;
    }
    if (crossSibling && !crossSibling.creatorId && creatorId && plan?.profile.action === "create") {
      crossSibling.creatorId = creatorId;
    }
    if (plan.contact.action === "create") {
      const email = normalizeEmail3(plan.contact.draft.email);
      const duplicate = next.contacts.some(
        (c) => c.email && normalizeEmail3(c.email) === email
      );
      if (!duplicate) {
        const contact = {
          id: shadowContactId(peer.jobId),
          creatorId,
          kind: "creator",
          name: plan.contact.draft.name.trim() || (plan.creator.action === "create" ? plan.creator.displayName : plan.creator.creator.displayName),
          company: "",
          email,
          phone: "",
          notes: "",
          status: "new",
          missiveConversationIds: [],
          createdAt: peer.createdAt
        };
        next.contacts.push(contact);
      }
    } else if (plan.contact.action === "link" && plan.contact.contact.creatorId && creatorId) {
      const linked = plan.contact.contact;
      const contact = next.contacts.find((c) => c.id === linked.id);
      if (contact && !contact.creatorId) contact.creatorId = creatorId;
    }
  }
  return next;
}
function plansMateriallyDiffer(a, b) {
  if (a.profile.action !== b.profile.action) return true;
  if (a.profile.action === "existing" && b.profile.action === "existing") {
    if (a.profile.profile.id !== b.profile.profile.id) return true;
  }
  if (a.creator.action !== b.creator.action) return true;
  if (a.creator.action === "link" && b.creator.action === "link") {
    if (a.creator.creator.id !== b.creator.creator.id) return true;
  } else if (a.creator.action === "create" && b.creator.action === "create") {
    if (a.creator.displayName.trim().toLowerCase() !== b.creator.displayName.trim().toLowerCase()) {
      return true;
    }
  }
  if (a.contact.action !== b.contact.action) return true;
  if (a.contact.action === "link" && b.contact.action === "link") {
    if (a.contact.contact.id !== b.contact.contact.id) return true;
  }
  if (a.contact.action === "create" && b.contact.action === "create") {
    if (normalizeEmail3(a.contact.draft.email) !== normalizeEmail3(b.contact.draft.email)) {
      return true;
    }
  }
  return false;
}
function collectQueueWarnings(plan, peers, forJobId, input) {
  const warnings = [];
  const others = peers.filter((p) => p.jobId !== forJobId);
  const normalizedInputHandle = normalizeHandle3(input.handle);
  for (const peer of others) {
    const ph = peerPlatformHandle(peer);
    if (ph && ph.platform !== input.platform && ph.handle === normalizedInputHandle) {
      warnings.push({
        code: "queue_cross_platform_handle",
        message: `@${normalizedInputHandle} is also queued on ${platformLabel(ph.platform)} \u2014 will link to the same creator when possible.`,
        severity: "info"
      });
    }
    if (ph && ph.platform === input.platform && ph.handle === normalizedInputHandle && ["pending", "scraping"].includes(peer.status)) {
      warnings.push({
        code: "queue_handle_pending",
        message: "Same handle is still loading earlier in the queue.",
        severity: "warn"
      });
    }
  }
  if (input.email) {
    const normalized = normalizeEmail3(input.email);
    for (const peer of others) {
      const peerEmail = peer.resolved?.draftContact?.email ?? (peer.plan?.contact.action === "create" ? peer.plan.contact.draft.email : peer.plan?.contact.action === "link" ? peer.plan.contact.contact.email : null);
      if (!peerEmail || normalizeEmail3(peerEmail) !== normalized) continue;
      const peerCreatorKey = peer.plan?.creator.action === "link" ? peer.plan.creator.creator.id : peer.plan?.creator.action === "create" ? peer.plan.creator.displayName.trim().toLowerCase() : null;
      const thisCreatorKey = plan.creator.action === "link" ? plan.creator.creator.id : plan.creator.displayName.trim().toLowerCase();
      if (peerCreatorKey && thisCreatorKey && peerCreatorKey !== thisCreatorKey) {
        warnings.push({
          code: "queue_email_conflict",
          message: `Email ${normalized} is queued for a different creator on another profile.`,
          severity: "block"
        });
      }
    }
  }
  const createName = plan.creator.action === "create" ? plan.creator.displayName.trim().toLowerCase() : null;
  if (createName) {
    for (const peer of others) {
      if (peer.plan?.creator.action !== "create") continue;
      if (peer.plan.creator.displayName.trim().toLowerCase() === createName) {
        warnings.push({
          code: "queue_creator_name_conflict",
          message: `Another queued profile will also create creator \u201C${peer.plan.creator.displayName}\u201D.`,
          severity: "block"
        });
      }
    }
  }
  if (plan.creator.action === "link" && plan.creator.reason === "Creator with matching display name") {
    warnings.push({
      code: "fuzzy_creator_name",
      message: "Creator matched by display name only \u2014 confirm this is the same person.",
      severity: "warn"
    });
  }
  if (plan.profile.action === "existing" && !plan.profile.profile.creatorId && plan.creator.action === "create") {
    warnings.push({
      code: "profile_unlinked",
      message: "Profile exists in CRM but is unlinked; a new creator will be created unless you adjust.",
      severity: "warn"
    });
  }
  return warnings;
}
function assessQuickAddJob(store, peers, forJobId, input, options) {
  const planningStore = buildPlanningStoreWithQueue(store, peers, forJobId);
  const plan = planQuickAdd(planningStore, {
    platform: input.platform,
    handle: input.handle,
    displayName: input.displayName,
    draftContact: input.draftContact
  });
  const email = input.draftContact?.email?.trim() ?? null;
  const queueWarnings = collectQueueWarnings(plan, peers, forJobId, {
    platform: input.platform,
    handle: input.handle,
    displayName: input.displayName,
    email
  });
  const warnings = [...queueWarnings];
  if (options?.storedPlan && plansMateriallyDiffer(plan, options.storedPlan)) {
    warnings.push({
      code: "plan_stale",
      message: "Plan changed because the queue or CRM was updated \u2014 review again.",
      severity: "warn"
    });
  }
  const readyPeers = peers.filter((p) => p.status === "ready").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const fifoIndex = readyPeers.findIndex((p) => p.jobId === forJobId);
  const readyAhead = fifoIndex > 0 ? fifoIndex : 0;
  if (readyAhead > 0) {
    warnings.push({
      code: "out_of_fifo_order",
      message: `${readyAhead} other profile(s) are ready ahead of this one \u2014 confirm in order when possible.`,
      severity: "info"
    });
  }
  const hasBlock = warnings.some((w) => w.severity === "block");
  const hasWarn = warnings.some((w) => w.severity === "warn");
  const autoConfirmEligible = !hasBlock && readyAhead === 0;
  const reviewRequired = hasBlock || hasWarn;
  return {
    plan,
    reviewRequired,
    autoConfirmEligible,
    warnings,
    fifoPosition: fifoIndex >= 0 ? fifoIndex + 1 : readyPeers.length + 1,
    readyAhead
  };
}
function assessQuickAddFromRow(store, allRows, row) {
  const resolved = row.resolved_payload;
  if (!resolved) return null;
  const peers = allRows.map(quickAddJobRowToPeer);
  return assessQuickAddJob(
    store,
    peers,
    row.id,
    {
      platform: resolved.platform,
      handle: resolved.username,
      displayName: resolved.name.trim() || resolved.username,
      draftContact: resolved.draftContact
    },
    { storedPlan: row.plan_payload ?? null }
  );
}

// lib/creator-outreach/quick-add-jobs.ts
function serializeQuickAddPlan(plan) {
  return structuredClone(plan);
}

// lib/database/creator-pipeline/mappers.ts
function mapCreatorRow(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    notes: row.notes,
    avatarProfileId: row.avatar_profile_id ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapProfileRow(row, creatorId) {
  return {
    id: row.id,
    platform: row.platform,
    handle: row.handle,
    displayName: row.display_name?.trim() ?? "",
    profileUrl: row.profile_url,
    avatarUrl: row.avatar_url ?? null,
    followerCount: row.follower_count,
    creatorId,
    notes: row.notes,
    scoutedAt: row.scouted_at,
    scoutedBy: row.scouted_by
  };
}
function mapContactRow(row, creatorId) {
  return {
    id: row.id,
    creatorId,
    kind: row.kind,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone ?? "",
    notes: row.notes,
    status: row.status,
    missiveConversationIds: Array.isArray(row.missive_conversation_ids) ? row.missive_conversation_ids : [],
    createdAt: row.created_at
  };
}
function mapTemplateRow(row) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyPreview: row.body_preview,
    isDefault: row.is_default
  };
}
function mapTouchpointRow(row) {
  return {
    id: row.id,
    email: row.email,
    profileId: row.profile_id,
    contactId: row.contact_id,
    creatorId: row.creator_id,
    addedAt: row.added_at
  };
}
function mapSendFromAddressRow(row) {
  const accountId = row.missive_account_id?.trim();
  const hostAvatarUrl = row.host_avatar_url?.trim();
  return {
    id: row.id,
    address: row.address,
    displayName: row.display_name,
    missiveAccountId: accountId || void 0,
    signatureHtml: row.signature_html?.trim() || void 0,
    hostAvatarUrl: hostAvatarUrl || void 0,
    bookingUrl: row.booking_url?.trim() || void 0,
    bookingMeetingName: row.booking_meeting_name?.trim() || void 0,
    bookingMeetingType: row.booking_meeting_type?.trim() || void 0,
    bookingDuration: row.booking_duration?.trim() || void 0,
    bookingActionLabel: row.booking_action_label?.trim() || void 0,
    enabled: row.enabled,
    isDefault: row.is_default
  };
}
function mapOutreachSendRow(row, fallbackFrom) {
  return {
    id: row.id,
    email: row.email,
    templateId: row.template_id,
    templateName: row.template_name,
    fromAddress: row.from_address ?? fallbackFrom?.address ?? "",
    fromDisplayName: row.from_display_name ?? fallbackFrom?.displayName ?? "",
    profileId: row.profile_id,
    contactId: row.contact_id,
    creatorId: row.creator_id,
    status: row.status,
    sentAt: row.sent_at
  };
}
function mapOutreachRuleRow(row) {
  return {
    id: row.id,
    enabled: row.enabled,
    trigger: row.trigger,
    contactKind: row.contact_kind,
    action: row.action,
    templateId: row.template_id,
    sendFromId: row.send_from_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapActivityRow(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at
  };
}
function applyAssociations(profiles, contacts, associations) {
  const profileCreator = /* @__PURE__ */ new Map();
  const contactCreator = /* @__PURE__ */ new Map();
  for (const a of associations) {
    if (a.profile_id) profileCreator.set(a.profile_id, a.creator_id);
    if (a.contact_id) contactCreator.set(a.contact_id, a.creator_id);
  }
  return {
    profiles: profiles.map((p) => mapProfileRow(p, profileCreator.get(p.id) ?? null)),
    contacts: contacts.map(
      (c) => mapContactRow(c, contactCreator.get(c.id) ?? null)
    )
  };
}

// lib/database/creator-pipeline/load-store.ts
async function fetchTable(label, query) {
  const { data, error } = await query;
  return { label, data: data ?? [], error };
}
function formatLoadErrors(results) {
  const failures = results.filter((r) => r.error != null);
  if (failures.length === 0) return null;
  return failures.map((r) => {
    const cause = r.error.cause;
    const causeText = cause instanceof Error ? cause.message : cause != null ? String(cause) : "";
    return `${r.label}: ${r.error.message}${causeText ? ` (${causeText})` : ""}`;
  }).join("; ");
}
function assertLoaded(results) {
  const msg = formatLoadErrors(results);
  if (msg) {
    throw new Error(`Failed to load creator pipeline: ${msg}`);
  }
}
async function loadCreatorOutreachStoreFromDb(supabase) {
  const db = creatorPipelineDb(supabase);
  const creatorsRes = await fetchTable(
    "creators",
    db.from("creators").select("*").order("created_at", { ascending: false })
  );
  const profilesRes = await fetchTable(
    "profiles",
    db.from("profiles").select("*").order("scouted_at", { ascending: false })
  );
  const contactsRes = await fetchTable(
    "contacts",
    db.from("contacts").select("*").order("created_at", { ascending: false })
  );
  const associationsRes = await fetchTable("associations", db.from("associations").select("*"));
  assertLoaded([creatorsRes, profilesRes, contactsRes, associationsRes]);
  const templatesRes = await fetchTable(
    "email_templates",
    db.from("email_templates").select("*").order("is_default", { ascending: false })
  );
  const sendFromRes = await fetchTable(
    "send_from_addresses",
    db.from("send_from_addresses").select("*").order("is_default", { ascending: false })
  );
  const rulesRes = await fetchTable(
    "outreach_rules",
    db.from("outreach_rules").select("*").order("contact_kind", { ascending: true })
  );
  const touchpointsRes = await fetchTable(
    "email_touchpoints",
    db.from("email_touchpoints").select("*").order("added_at", { ascending: false })
  );
  assertLoaded([templatesRes, sendFromRes, rulesRes, touchpointsRes]);
  const sendsRes = await fetchTable(
    "outreach_sends",
    db.from("outreach_sends").select("*").order("sent_at", { ascending: false })
  );
  const activityRes = await fetchTable(
    "activity_events",
    db.from("activity_events").select("*").order("created_at", { ascending: false })
  );
  assertLoaded([sendsRes, activityRes]);
  const sendFromAddresses = sendFromRes.data.map(mapSendFromAddressRow);
  const defaultSendFrom = sendFromAddresses.find((s) => s.isDefault) ?? sendFromAddresses[0];
  const sendFromFallback = defaultSendFrom ? { address: defaultSendFrom.address, displayName: defaultSendFrom.displayName } : void 0;
  const creators = creatorsRes.data.map(mapCreatorRow);
  const { profiles, contacts } = applyAssociations(
    profilesRes.data,
    contactsRes.data,
    associationsRes.data
  );
  return {
    creators,
    profiles,
    contacts,
    emailTouchpoints: touchpointsRes.data.map(mapTouchpointRow),
    templates: templatesRes.data.map(mapTemplateRow),
    sendFromAddresses,
    outreachRules: rulesRes.data.map(mapOutreachRuleRow),
    outreachSends: sendsRes.data.map(
      (row) => mapOutreachSendRow(row, sendFromFallback)
    ),
    activity: activityRes.data.map(mapActivityRow)
  };
}

// lib/database/creator-pipeline/quick-add-plan-sync.ts
var ACTIVE_STATUSES = ["pending", "scraping", "ready", "confirming", "failed"];
async function loadQuickAddJobRows(supabase, options) {
  const db = creatorPipelineDb(supabase);
  const { data: active, error } = await db.from("quick_add_jobs").select("*").in("status", [...ACTIVE_STATUSES]).order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load quick add jobs: ${error.message}`);
  const rows = active ?? [];
  const hours = options?.includeRecentReadyHours ?? 72;
  const since = new Date(Date.now() - hours * 60 * 60 * 1e3).toISOString();
  const { data: recentReady, error: recentError } = await db.from("quick_add_jobs").select("*").eq("status", "ready").gte("scraped_at", since).order("created_at", { ascending: true });
  if (recentError) {
    throw new Error(`Failed to load recent ready jobs: ${recentError.message}`);
  }
  const byId = /* @__PURE__ */ new Map();
  for (const row of rows) byId.set(row.id, row);
  for (const row of recentReady ?? []) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
async function syncReadyQuickAddJobPlans(supabase) {
  const db = creatorPipelineDb(supabase);
  const allRows = await loadQuickAddJobRows(supabase);
  const store = await loadCreatorOutreachStoreFromDb(supabase);
  for (const row of allRows) {
    if (row.status !== "ready") continue;
    const assessment = assessQuickAddFromRow(store, allRows, row);
    if (!assessment) continue;
    await db.from("quick_add_jobs").update({
      plan_payload: serializeQuickAddPlan(assessment.plan),
      review_required: assessment.reviewRequired,
      auto_confirm_eligible: assessment.autoConfirmEligible,
      plan_warnings: assessment.warnings,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", row.id).eq("status", "ready");
  }
}

// lib/database/creator-pipeline/process-quick-add-scrape.ts
function workerBatchSize() {
  const raw = readRuntimeEnv("QUICK_ADD_WORKER_BATCH_SIZE");
  const n = raw ? Number(raw) : 3;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10) : 3;
}
async function claimPendingJobs(db, limit) {
  const { data, error } = await db.from("quick_add_jobs").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error(`Failed to load quick add jobs: ${error.message}`);
  const rows = data ?? [];
  const claimed = [];
  for (const row of rows) {
    const { data: updated, error: claimError } = await db.from("quick_add_jobs").update({
      status: "scraping",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", row.id).eq("status", "pending").select("*").maybeSingle();
    if (claimError) {
      throw new Error(`Failed to claim quick add job: ${claimError.message}`);
    }
    if (updated) claimed.push(updated);
  }
  return claimed;
}
async function scrapeJob(supabase, db, row) {
  try {
    const resolved = await resolveSocialProfileFromUrl(row.url);
    if (!resolved) {
      throw new Error("Could not resolve profile from URL.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { error } = await db.from("quick_add_jobs").update({
      status: "ready",
      resolved_payload: resolved,
      error_message: null,
      scraped_at: now,
      updated_at: now
    }).eq("id", row.id).eq("status", "scraping");
    if (error) throw new Error(error.message);
    await syncReadyQuickAddJobPlans(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    await db.from("quick_add_jobs").update({
      status: "failed",
      error_message: message,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", row.id);
  }
}
async function tallyScrapeResults(db, row) {
  const { data } = await db.from("quick_add_jobs").select("status").eq("id", row.id).maybeSingle();
  return data?.status === "ready" ? "ready" : "failed";
}
async function processPendingQuickAddJobs(supabase, options) {
  const db = creatorPipelineDb(supabase);
  const limit = options?.limit ?? workerBatchSize();
  const claimed = await claimPendingJobs(db, limit);
  let ready = 0;
  let failed = 0;
  const runOne = async (row) => {
    await scrapeJob(supabase, db, row);
    if (await tallyScrapeResults(db, row) === "ready") ready++;
    else failed++;
  };
  if (options?.sequential) {
    for (const row of claimed) {
      await runOne(row);
    }
  } else {
    await Promise.all(claimed.map(runOne));
  }
  if (claimed.length > 0) {
    await syncReadyQuickAddJobPlans(supabase);
  }
  return { claimed: claimed.length, ready, failed };
}
export {
  processPendingQuickAddJobs,
  readRuntimeEnv
};
