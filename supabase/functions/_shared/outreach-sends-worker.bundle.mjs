// lib/creator-outreach/template-segments.ts
function sanitizeTemplateInlineHtml(html) {
  if (!html || !/<[a-z]/i.test(html)) return html;
  let out = html.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\s*(strong|b)\s*>/gi, "<strong>");
  out = out.replace(/<\s*\/\s*(strong|b)\s*>/gi, "</strong>");
  out = out.replace(/<\s*(em|i)\s*>/gi, "<em>");
  out = out.replace(/<\s*\/\s*(em|i)\s*>/gi, "</em>");
  out = out.replace(/<(?!\/?(strong|em)\b)[^>]*>/gi, "");
  return out;
}

// lib/creator-outreach/template-email-html.ts
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function paragraphInnerHtml(paragraph) {
  if (!paragraph) return "<br>";
  if (/<[a-z]/i.test(paragraph)) {
    return sanitizeTemplateInlineHtml(paragraph).replace(/\n/g, "<br>");
  }
  return escapeHtml(paragraph).replace(/\n/g, "<br>");
}
function outreachPlainTextToEmailHtml(text) {
  const trimmed = text.trim();
  if (!trimmed) return "<div><br></div>";
  return trimmed.split(/\n\n+/).map((paragraph) => `<div>${paragraphInnerHtml(paragraph.trim())}</div>`).join("<div><br></div>");
}

// lib/creator-outreach/cal-booking.ts
var BOOK_MEETING_PLACEHOLDER = "book_meeting";
var BOOK_MEETING_TOKEN = `{{${BOOK_MEETING_PLACEHOLDER}}}`;
var DEFAULT_MEETING_DETAILS = {
  meetingName: "Intro call",
  meetingType: "Video call",
  duration: "30 min",
  actionLabel: "Pick a time"
};
var FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
function normalizeBookingUrl(url) {
  if (!url?.trim()) return void 0;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return void 0;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return void 0;
  }
}
function meetingNameFromCalUrl(url) {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!slug) return void 0;
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return void 0;
  }
}
function hostInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
function normalizeHostAvatarUrl(url) {
  if (!url?.trim()) return void 0;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return void 0;
    return parsed.toString();
  } catch {
    return void 0;
  }
}
function resolveCalBookingMeetingDetails(input) {
  const url = normalizeBookingUrl(input?.url);
  const meetingName = input?.meetingName?.trim() || (url ? meetingNameFromCalUrl(url) : void 0) || DEFAULT_MEETING_DETAILS.meetingName;
  return {
    url,
    meetingName,
    meetingType: input?.meetingType?.trim() || DEFAULT_MEETING_DETAILS.meetingType,
    duration: input?.duration?.trim() || DEFAULT_MEETING_DETAILS.duration,
    actionLabel: input?.actionLabel?.trim() || DEFAULT_MEETING_DETAILS.actionLabel,
    hostName: input?.hostName?.trim() || void 0,
    hostAvatarUrl: normalizeHostAvatarUrl(input?.hostAvatarUrl)
  };
}
function bookingDetailsFromSender(sender) {
  return resolveCalBookingMeetingDetails({
    url: sender.bookingUrl,
    meetingName: sender.bookingMeetingName,
    meetingType: sender.bookingMeetingType,
    duration: sender.bookingDuration,
    actionLabel: sender.bookingActionLabel,
    hostName: sender.displayName,
    hostAvatarUrl: sender.hostAvatarUrl
  });
}
function escapeHtml2(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function emailAvatarHtml(details) {
  const hostName = details.hostName?.trim() || "Host";
  const safeName = escapeHtml2(hostName);
  const avatarUrl = normalizeHostAvatarUrl(details.hostAvatarUrl);
  if (avatarUrl) {
    const safeUrl = avatarUrl.replace(/"/g, "&quot;");
    return `<img src="${safeUrl}" width="40" height="40" alt="${safeName}" style="display:block;width:40px;height:40px;border-radius:9999px;object-fit:cover;border:1px solid #e5e7eb;background:#f3f4f6;" />`;
  }
  const initials = escapeHtml2(hostInitials(hostName));
  return `<div style="width:40px;height:40px;border-radius:9999px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:40px;font-size:12px;font-weight:500;color:#4b5563;">${initials}</div>`;
}
function buildCalBookingCardInnerHtml(details) {
  const meetingName = escapeHtml2(details.meetingName);
  const meta = escapeHtml2(`${details.meetingType} \xB7 ${details.duration}`);
  const actionLabel = escapeHtml2(details.actionLabel);
  const hostLine = details.hostName?.trim() ? escapeHtml2(`Call with ${details.hostName.trim()}`) : "Schedule a call";
  const avatar = emailAvatarHtml(details);
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;font-family:${FONT_STACK};">
<tr>
<td style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td width="40" valign="top" style="width:40px;padding-right:12px;">${avatar}</td>
<td valign="top">
<div style="font-size:11px;line-height:1.4;color:#6b7280;">${hostLine}</div>
<div style="margin-top:3px;font-size:14px;font-weight:500;line-height:1.4;color:#111827;">${meetingName}</div>
<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#9ca3af;">${meta}</div>
</td>
</tr>
</table>
<div style="margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6;font-size:12px;font-weight:500;line-height:1.4;color:#374151;">${actionLabel} &rarr;</div>
</td>
</tr>
</table>`;
}
function buildCalBookingWidgetHtml(details) {
  const card = buildCalBookingCardInnerHtml(details);
  if (!details.url?.trim()) {
    return `<div style="margin:20px 0;max-width:340px;">${card}</div>`;
  }
  const href = details.url.replace(/"/g, "&quot;");
  return `<div style="margin:20px 0;max-width:340px;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:inherit;">${card}</a></div>`;
}
function replaceBookMeetingInPlainText(text, details) {
  if (!text.includes(BOOK_MEETING_TOKEN)) return text;
  const meeting = resolveCalBookingMeetingDetails(details);
  const host = meeting.hostName ? ` with ${meeting.hostName}` : "";
  const replacement = meeting.url ? `${meeting.meetingName}${host} (${meeting.meetingType}, ${meeting.duration}): ${meeting.url}` : meeting.meetingName;
  return text.split(BOOK_MEETING_TOKEN).join(replacement);
}
function outreachBodyToEmailHtml(body, options) {
  const trimmed = body.trim();
  if (!trimmed) return "<div><br></div>";
  if (!trimmed.includes(BOOK_MEETING_TOKEN)) {
    return outreachPlainTextToEmailHtml(trimmed);
  }
  const widgetHtml = buildCalBookingWidgetHtml(resolveCalBookingMeetingDetails(options));
  const parts = trimmed.split(BOOK_MEETING_TOKEN);
  return parts.map((part) => outreachPlainTextToEmailHtml(part)).join(widgetHtml);
}

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

// lib/creator-outreach/outreach-email-body.ts
var BODY_SIGNATURE_SEPARATOR = "<div><br></div>";
function appendOutreachSignatureHtml(bodyHtml, signatureHtml) {
  const body = bodyHtml.trim();
  const signature = signatureHtml?.trim();
  if (!signature) return body || "<div><br></div>";
  if (!body) return signature;
  return `${body}${BODY_SIGNATURE_SEPARATOR}${signature}`;
}

// lib/creator-outreach/missive.ts
function missiveEnv(name) {
  return readRuntimeEnv(name);
}
function missiveEnvFlag(name, defaultValue = true) {
  const value = readRuntimeEnv(name);
  if (!value) return defaultValue;
  return value !== "false";
}
var MISSIVE_API_BASE = "https://public.missiveapp.com/v1";
function renderOutreachTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
function replySubject(subject) {
  const trimmed = subject.trim();
  if (/^re:\s/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}
function parseMissiveErrorMessage(data, raw, status) {
  if (data && typeof data === "object" && data !== null) {
    const root = data;
    if (root.error && typeof root.error === "object" && root.error !== null) {
      const msg = root.error.message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
    if (typeof root.message === "string" && root.message.trim()) {
      return root.message.trim();
    }
  }
  return raw.slice(0, 300) || `HTTP ${status}`;
}
function isSenderMismatchError(message) {
  const lower = message.toLowerCase();
  return lower.includes("does not match an available sender") || lower.includes("cannot send from");
}
function isAccountNotFoundError(message) {
  const lower = message.toLowerCase();
  return lower.includes("account with id") && lower.includes("does not exist");
}
function resolveMissiveAccountId(context) {
  const fromContext = context.missiveAccountId?.trim();
  if (fromContext) return fromContext;
  return missiveEnv("MISSIVE_ACCOUNT_ID");
}
function allowPersonalEmailFallback() {
  return missiveEnvFlag("MISSIVE_ALLOW_PERSONAL_FALLBACK", true);
}
function senderMismatchHelp(requested, tried, tokenOwnerEmail, accountId) {
  const triedLine = tried.length ? ` Tried: ${tried.join(", ")}.` : "";
  const ownerLine = tokenOwnerEmail ? ` API token user: ${tokenOwnerEmail}.` : "";
  const accountLine = accountId ? ` The Missive account ID on the sender is only used as a fallback; Gmail outreach still requires the alias in API "available senders".` : "";
  const fallbackLine = allowPersonalEmailFallback() ? ` Set MISSIVE_ALLOW_PERSONAL_FALLBACK=false to disable sending from ${tokenOwnerEmail ?? "your personal email"} when the alias fails.` : ` Personal-email fallback is disabled (MISSIVE_ALLOW_PERSONAL_FALLBACK=false).`;
  return `Missive API cannot send from "${requested}" \u2014 this alias is not in the token user's API send list.${triedLine}${ownerLine}${accountLine} Fix: Missive \u2192 Settings \u2192 Accounts \u2192 your shared Gmail account \u2192 Aliases \u2192 ${requested} \u2192 "Allow others to send" \u2192 add ${tokenOwnerEmail ?? "the API token user"}. Composing in the team inbox is not enough.${fallbackLine}`;
}
async function getMissiveTokenOwnerEmail(token) {
  const result = await missiveApiRequest(
    token,
    "/users",
    { method: "GET" }
  );
  if (!result.ok) return null;
  const me = result.data.users?.find((u) => u.me);
  const email = me?.email?.trim().toLowerCase();
  return email || null;
}
function normalizeEmailAddress(addr) {
  const normalized = addr?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}
function buildSendFromCandidates(primary, extras) {
  const seen = /* @__PURE__ */ new Set();
  const list = [];
  const add = (addr) => {
    const normalized = normalizeEmailAddress(addr);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    list.push(normalized);
  };
  add(primary);
  for (const extra of extras) add(extra);
  add(missiveEnv("MISSIVE_FROM_ADDRESS"));
  add(missiveEnv("MISSIVE_SEND_FROM_ADDRESS"));
  return list;
}
function pipelineSenderForAddress(context, address) {
  const normalized = address.toLowerCase();
  return context.pipelineSenders?.find((s) => s.address.toLowerCase() === normalized);
}
function accountIdForAddress(context, address) {
  const fromRow = pipelineSenderForAddress(context, address)?.missiveAccountId?.trim();
  if (fromRow) return fromRow;
  if (address.toLowerCase() === normalizeEmailAddress(context.fromAddress)) {
    return resolveMissiveAccountId(context);
  }
  return void 0;
}
function displayNameForAddress(context, address, fallback) {
  const fromRow = pipelineSenderForAddress(context, address)?.displayName?.trim();
  return fromRow || fallback;
}
function hasSharedInboxConfigured(context) {
  if (resolveMissiveAccountId(context)) return true;
  return (context.pipelineSenders ?? []).some((s) => Boolean(s.missiveAccountId?.trim()));
}
async function missiveApiRequest(token, path, init) {
  let res;
  try {
    res = await fetch(`${MISSIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers ?? {}
      }
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Missive request failed"
    };
  }
  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const detail = parseMissiveErrorMessage(data, raw, res.status);
    return { ok: false, reason: `Missive API ${res.status}: ${detail}`, status: res.status };
  }
  return { ok: true, data };
}
function conversationIdFromDraftResponse(data) {
  if (!data || typeof data !== "object") return null;
  const root = data;
  const drafts = root.drafts;
  if (drafts && typeof drafts === "object" && !Array.isArray(drafts)) {
    const conv = drafts.conversation;
    if (typeof conv === "string" && conv) return conv;
  }
  if (Array.isArray(drafts) && drafts[0] && typeof drafts[0] === "object") {
    const conv = drafts[0].conversation;
    if (typeof conv === "string" && conv) return conv;
  }
  const conversations = root.conversations;
  if (Array.isArray(conversations) && conversations[0] && typeof conversations[0] === "object") {
    const id = conversations[0].id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}
async function findConversationByRecipientEmail(token, email) {
  const params = new URLSearchParams({ email, limit: "1" });
  const result = await missiveApiRequest(
    token,
    `/conversations?${params}`,
    { method: "GET" }
  );
  if (!result.ok) return null;
  const id = result.data.conversations?.[0]?.id;
  return id ?? null;
}
async function createAndSendDraft(token, draft) {
  const created = await missiveApiRequest(token, "/drafts", {
    method: "POST",
    body: JSON.stringify({ drafts: draft })
  });
  if (created.ok) {
    return { ok: true, data: created.data };
  }
  const senderMismatch = isSenderMismatchError(created.reason);
  return { ok: false, reason: created.reason, senderMismatch };
}
async function createAndSendEmailDraft(token, draft, accountId) {
  const { account: _existing, ...base } = draft;
  const withoutAccount = await createAndSendDraft(token, base);
  if (withoutAccount.ok || !accountId) {
    return withoutAccount;
  }
  if (!withoutAccount.senderMismatch) {
    return withoutAccount;
  }
  const withAccount = await createAndSendDraft(token, { ...base, account: accountId });
  if (withAccount.ok) {
    return withAccount;
  }
  if (isAccountNotFoundError(withAccount.reason)) {
    console.warn(
      `[missive] Account ${accountId} not visible to this API token for email send; alias must be in API available senders`
    );
  }
  return withoutAccount;
}
async function sendQueuedOutreachViaMissive(send, template, context) {
  const token = missiveEnv("MISSIVE_API_TOKEN");
  if (!token) {
    return { ok: false, reason: "MISSIVE_API_TOKEN not configured" };
  }
  const fromAddress = context.fromAddress?.trim().toLowerCase();
  if (!fromAddress || !fromAddress.includes("@")) {
    return { ok: false, reason: "Send-from address missing on outreach send" };
  }
  const vars = {
    creator_name: context.creatorName,
    contact_name: context.contactName,
    platform: context.platform ?? "",
    handle: context.handle ?? ""
  };
  const renderedSubject = replaceBookMeetingInPlainText(
    renderOutreachTemplate(template.subject, vars).trim(),
    context.bookingDetails
  );
  const renderedBody = renderOutreachTemplate(template.bodyPreview, vars).trim();
  const body = appendOutreachSignatureHtml(
    outreachBodyToEmailHtml(renderedBody, context.bookingDetails),
    context.signatureHtml
  );
  const existingConversationId = context.existingConversationId?.trim() || null;
  const subject = existingConversationId ? replySubject(renderedSubject) : renderedSubject;
  const teamId = missiveEnv("MISSIVE_TEAM_ID");
  const organizationId = missiveEnv("MISSIVE_ORGANIZATION_ID");
  const fromName = context.fromDisplayName?.trim() || missiveEnv("MISSIVE_FROM_NAME") || void 0;
  const baseDraft = {
    subject,
    body,
    send: true,
    to_fields: [{ address: send.email, name: context.contactName || void 0 }]
  };
  if (existingConversationId) {
    baseDraft.conversation = existingConversationId;
  } else if (teamId) {
    baseDraft.team = teamId;
    baseDraft.add_to_team_inbox = true;
    if (organizationId) {
      baseDraft.organization = organizationId;
    }
  }
  const configuredFrom = fromAddress.toLowerCase();
  const tokenOwnerEmail = await getMissiveTokenOwnerEmail(token);
  const sharedInbox = hasSharedInboxConfigured(context);
  const configuredAccountId = accountIdForAddress(context, configuredFrom);
  const candidates = sharedInbox ? [
    configuredFrom,
    ...allowPersonalEmailFallback() && tokenOwnerEmail ? [tokenOwnerEmail] : []
  ] : buildSendFromCandidates(fromAddress, [
    ...context.pipelineSenders?.map((s) => s.address) ?? context.fallbackFromAddresses ?? [],
    tokenOwnerEmail ?? ""
  ]);
  let lastReason = "No send-from address available";
  let lastSenderMismatch = false;
  const tried = [];
  let sentData = null;
  let usedFrom = configuredFrom;
  let personalFallback = false;
  for (const candidate of candidates) {
    tried.push(candidate);
    const useAccount = candidate === configuredFrom ? configuredAccountId : void 0;
    const candidateName = displayNameForAddress(context, candidate, fromName);
    const fromField = { address: candidate };
    if (candidateName) {
      fromField.name = candidateName;
    }
    const created = await createAndSendEmailDraft(
      token,
      {
        ...baseDraft,
        from_field: fromField
      },
      useAccount
    );
    if (created.ok) {
      sentData = created.data;
      usedFrom = candidate;
      personalFallback = candidate === tokenOwnerEmail?.toLowerCase() && candidate !== configuredFrom;
      if (personalFallback) {
        console.warn(
          `[missive] Sent from ${candidate} (personal fallback). Configured sender ${configuredFrom} is not API-allowed yet.`
        );
      }
      break;
    }
    lastReason = created.reason;
    lastSenderMismatch = created.senderMismatch;
    if (!created.senderMismatch) {
      return { ok: false, reason: created.reason };
    }
  }
  if (!sentData) {
    return {
      ok: false,
      reason: lastSenderMismatch ? senderMismatchHelp(fromAddress, tried, tokenOwnerEmail, configuredAccountId) : lastReason
    };
  }
  let conversationId = conversationIdFromDraftResponse(sentData) ?? existingConversationId;
  if (!conversationId) {
    for (let attempt = 0; attempt < 3 && !conversationId; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      conversationId = await findConversationByRecipientEmail(token, send.email);
    }
  }
  if (!conversationId) {
    return {
      ok: false,
      reason: "Missive accepted the send but no conversation id was returned. Check the team inbox in Missive."
    };
  }
  return {
    ok: true,
    conversationId,
    fromAddress: usedFrom,
    configuredFromAddress: configuredFrom,
    personalFallback
  };
}

// lib/creator-outreach/resolve-send-from.ts
function defaultSendFromAddress(store) {
  return store.sendFromAddresses.find((s) => s.enabled && s.isDefault) ?? store.sendFromAddresses.find((s) => s.enabled);
}

// lib/creator-outreach/crm-status.ts
var CRM_STATUS_RANK = {
  new: 0,
  contacted: 1,
  reached: 2,
  blocked: 3
};
function deriveCreatorCrmStatusFromContacts(store, creatorId) {
  const list = store.contacts.filter((c) => c.creatorId === creatorId);
  if (list.length === 0) return "new";
  return list.reduce(
    (best, c) => CRM_STATUS_RANK[c.status] > CRM_STATUS_RANK[best] ? c.status : best,
    "new"
  );
}

// lib/creator-outreach/rules-engine.ts
function uid() {
  return crypto.randomUUID();
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function markContactCrmStatusAfterSuccessfulSend(store, contactId) {
  if (!contactId) return;
  const contact = store.contacts.find((c) => c.id === contactId);
  if (!contact) return;
  if (contact.status === "blocked" || contact.status === "reached") return;
  contact.status = "contacted";
  if (contact.creatorId) {
    const creator = store.creators.find((c) => c.id === contact.creatorId);
    if (creator) {
      creator.status = deriveCreatorCrmStatusFromContacts(store, contact.creatorId);
    }
  }
}
function pushActivity(store, type, message) {
  store.activity.unshift({
    id: uid(),
    type,
    message,
    createdAt: nowIso()
  });
}
function markOutreachSendDelivered(store, send, conversationId, contact) {
  send.status = "sent";
  if (contact && !contact.missiveConversationIds.includes(conversationId)) {
    contact.missiveConversationIds.push(conversationId);
  }
  pushActivity(
    store,
    "outreach_sent",
    `Sent "${send.templateName}" to ${send.email} via Missive`
  );
  markContactCrmStatusAfterSuccessfulSend(store, send.contactId);
}

// lib/creator-outreach/store.ts
function platformLabel(platform) {
  return platform === "tiktok" ? "TikTok" : "Instagram";
}

// lib/creator-pipeline/constants.ts
var CREATOR_PIPELINE_SCHEMA = "creator_pipeline";

// lib/database/creator-pipeline/client.ts
function creatorPipelineDb(supabase) {
  return supabase.schema(CREATOR_PIPELINE_SCHEMA);
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
function creatorToRow(c) {
  return {
    id: c.id,
    display_name: c.displayName,
    notes: c.notes,
    avatar_profile_id: c.avatarProfileId,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt
  };
}
function profileToRow(p) {
  return {
    id: p.id,
    platform: p.platform,
    handle: p.handle,
    display_name: p.displayName,
    profile_url: p.profileUrl,
    avatar_url: p.avatarUrl,
    follower_count: p.followerCount,
    notes: p.notes,
    scouted_at: p.scoutedAt,
    scouted_by: p.scoutedBy
  };
}
function contactToRow(c) {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    status: c.status,
    missive_conversation_ids: c.missiveConversationIds,
    created_at: c.createdAt
  };
}
function buildAssociationRows(store) {
  const rows = [];
  for (const profile of store.profiles) {
    if (profile.creatorId) {
      rows.push({
        creator_id: profile.creatorId,
        profile_id: profile.id,
        contact_id: null
      });
    }
  }
  for (const contact of store.contacts) {
    if (!contact.creatorId) continue;
    rows.push({
      creator_id: contact.creatorId,
      profile_id: null,
      contact_id: contact.id
    });
  }
  return rows;
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

// lib/database/creator-pipeline/persist-store.ts
var AVATAR_PROFILE_ID_MIGRATION = "supabase/migrations/20260528200000_creator_pipeline_creator_avatar_profile.sql";
function isMissingAvatarProfileIdColumn(error) {
  const msg = error?.message ?? "";
  return msg.includes("avatar_profile_id") && msg.includes("schema cache");
}
async function upsertCreators(db, creatorRows) {
  if (creatorRows.length === 0) {
    return { error: null, avatarProfileIdPersisted: true };
  }
  let result = await db.from("creators").upsert(creatorRows);
  if (!isMissingAvatarProfileIdColumn(result.error)) {
    return { error: result.error, avatarProfileIdPersisted: true };
  }
  console.warn(
    `creators.avatar_profile_id not in DB yet \u2014 persisting without it. Run ${AVATAR_PROFILE_ID_MIGRATION}`
  );
  const legacyRows = creatorRows.map(
    ({ avatar_profile_id: _avatarProfileId, ...row }) => row
  );
  result = await db.from("creators").upsert(legacyRows);
  return { error: result.error, avatarProfileIdPersisted: false };
}
function templateToRow(t) {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    body_preview: t.bodyPreview,
    is_default: t.isDefault
  };
}
function touchpointToRow(t) {
  return {
    id: t.id,
    email: t.email,
    profile_id: t.profileId,
    contact_id: t.contactId,
    creator_id: t.creatorId,
    added_at: t.addedAt
  };
}
function outreachSendToRow(s) {
  return {
    id: s.id,
    email: s.email,
    template_id: s.templateId,
    template_name: s.templateName,
    from_address: s.fromAddress || null,
    from_display_name: s.fromDisplayName || null,
    profile_id: s.profileId,
    contact_id: s.contactId,
    creator_id: s.creatorId,
    status: s.status,
    sent_at: s.sentAt
  };
}
function activityToRow(e) {
  return {
    id: e.id,
    type: e.type,
    message: e.message,
    created_at: e.createdAt
  };
}
async function persistCreatorOutreachStoreToDb(supabase, store) {
  const db = creatorPipelineDb(supabase);
  const creatorRows = store.creators.map(creatorToRow);
  const profileRows = store.profiles.map(profileToRow);
  const contactRows = store.contacts.map(contactToRow);
  const associationRows = buildAssociationRows(store);
  const creatorUpsert = await upsertCreators(db, creatorRows);
  if (creatorUpsert.error) {
    throw new Error(`Failed to persist creator pipeline: ${creatorUpsert.error.message}`);
  }
  const coreUpserts = await Promise.all([
    profileRows.length ? db.from("profiles").upsert(profileRows) : Promise.resolve({ error: null }),
    contactRows.length ? db.from("contacts").upsert(contactRows) : Promise.resolve({ error: null }),
    store.templates.length ? db.from("email_templates").upsert(store.templates.map(templateToRow)) : Promise.resolve({ error: null })
  ]);
  const coreError = coreUpserts.find((r) => r.error)?.error;
  if (coreError) {
    throw new Error(`Failed to persist creator pipeline: ${coreError.message}`);
  }
  const dependentUpserts = await Promise.all([
    store.emailTouchpoints.length ? db.from("email_touchpoints").upsert(store.emailTouchpoints.map(touchpointToRow)) : Promise.resolve({ error: null }),
    store.outreachSends.length ? db.from("outreach_sends").upsert(store.outreachSends.map(outreachSendToRow)) : Promise.resolve({ error: null }),
    store.activity.length ? db.from("activity_events").upsert(store.activity.map(activityToRow)) : Promise.resolve({ error: null })
  ]);
  const dependentError = dependentUpserts.find((r) => r.error)?.error;
  if (dependentError) {
    throw new Error(`Failed to persist creator pipeline: ${dependentError.message}`);
  }
  const { error: deleteAssocError } = await db.from("associations").delete().not("creator_id", "is", null);
  if (deleteAssocError) {
    throw new Error(`Failed to reset associations: ${deleteAssocError.message}`);
  }
  if (associationRows.length > 0) {
    const { error: insertAssocError } = await db.from("associations").insert(associationRows);
    if (insertAssocError) {
      throw new Error(`Failed to persist associations: ${insertAssocError.message}`);
    }
  }
  await pruneOrphanPipelineRows(db, store);
}
async function pruneOrphanPipelineRows(db, store) {
  await pruneTableRows(db, "creators", store.creators.map((c) => c.id));
  await pruneTableRows(db, "profiles", store.profiles.map((p) => p.id));
  await pruneTableRows(db, "contacts", store.contacts.map((c) => c.id));
}
async function pruneTableRows(db, table, keepIds) {
  const { data: existing, error: selectError } = await db.from(table).select("id");
  if (selectError) {
    throw new Error(`Failed to list ${table} for prune: ${selectError.message}`);
  }
  const keep = new Set(keepIds);
  const orphanIds = (existing ?? []).map((row) => row.id).filter((id) => !keep.has(id));
  if (orphanIds.length === 0) return;
  const { error: deleteError } = await db.from(table).delete().in("id", orphanIds);
  if (deleteError) {
    throw new Error(`Failed to prune ${table}: ${deleteError.message}`);
  }
}

// lib/database/creator-pipeline/process-outreach-sends.ts
function senderBatchSize() {
  const raw = readRuntimeEnv("OUTREACH_SEND_BATCH_SIZE");
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 20) : 5;
}
async function processMissiveForSendIds(supabase, sendIds) {
  if (sendIds.length === 0) return { sent: 0, failed: 0 };
  const store = await loadCreatorOutreachStoreFromDb(supabase);
  const templateById = new Map(store.templates.map((t) => [t.id, t]));
  let sent = 0;
  let failed = 0;
  let lastError;
  let lastWarning;
  for (const sendId of sendIds) {
    const send = store.outreachSends.find((s) => s.id === sendId);
    if (!send || send.status !== "queued") continue;
    const tpl = templateById.get(send.templateId);
    if (!tpl) {
      failed += 1;
      lastError = `Template not found for send ${sendId}`;
      continue;
    }
    const contact = send.contactId ? store.contacts.find((c) => c.id === send.contactId) : void 0;
    const creator = send.creatorId ? store.creators.find((c) => c.id === send.creatorId) : contact?.creatorId ? store.creators.find((c) => c.id === contact.creatorId) : void 0;
    const profile = send.profileId != null ? store.profiles.find((p) => p.id === send.profileId) : contact?.creatorId ? store.profiles.find((p) => p.creatorId === contact.creatorId) : void 0;
    const defaultFrom = defaultSendFromAddress(store);
    const ruleFromAddress = send.fromAddress || defaultFrom?.address;
    const ruleFromDisplayName = send.fromDisplayName || defaultFrom?.displayName;
    const ruleSender = store.sendFromAddresses.find(
      (s) => s.address.toLowerCase() === (ruleFromAddress ?? "").toLowerCase()
    );
    const missiveAccountId = ruleSender?.missiveAccountId ?? defaultFrom?.missiveAccountId;
    const signatureHtml = ruleSender?.signatureHtml ?? defaultFrom?.signatureHtml;
    if (!ruleFromAddress) {
      failed += 1;
      lastError = "No send-from address on queued outreach";
      continue;
    }
    const missiveContext = {
      contactName: contact?.name ?? send.email,
      creatorName: creator?.displayName ?? contact?.name ?? "Creator",
      platform: profile ? platformLabel(profile.platform) : void 0,
      handle: profile?.handle,
      existingConversationId: contact?.missiveConversationIds[contact.missiveConversationIds.length - 1] ?? null
    };
    const pipelineSenders = store.sendFromAddresses.filter((s) => s.enabled).map((s) => ({
      address: s.address,
      missiveAccountId: s.missiveAccountId,
      displayName: s.displayName,
      signatureHtml: s.signatureHtml
    }));
    const missive = await sendQueuedOutreachViaMissive(send, tpl, {
      ...missiveContext,
      fromAddress: ruleFromAddress,
      fromDisplayName: ruleFromDisplayName,
      pipelineSenders,
      missiveAccountId,
      signatureHtml,
      bookingDetails: bookingDetailsFromSender({
        displayName: ruleFromDisplayName ?? "",
        hostAvatarUrl: ruleSender?.hostAvatarUrl,
        bookingUrl: ruleSender?.bookingUrl,
        bookingMeetingName: ruleSender?.bookingMeetingName,
        bookingMeetingType: ruleSender?.bookingMeetingType,
        bookingDuration: ruleSender?.bookingDuration,
        bookingActionLabel: ruleSender?.bookingActionLabel
      })
    });
    if (!missive.ok) {
      failed += 1;
      lastError = missive.reason;
      console.error(`Missive send failed for ${send.email}:`, missive.reason);
      continue;
    }
    if (missive.personalFallback) {
      const matched = store.sendFromAddresses.find(
        (s) => s.address.toLowerCase() === missive.fromAddress.toLowerCase()
      );
      send.fromAddress = missive.fromAddress;
      send.fromDisplayName = matched?.displayName ?? send.fromDisplayName;
      lastWarning = `Email sent from ${missive.fromAddress} (API token user), not ${missive.configuredFromAddress}. Enable "Allow others to send" on that alias in Missive for API sends from the shared inbox.`;
    }
    markOutreachSendDelivered(store, send, missive.conversationId, contact ?? null);
    sent += 1;
  }
  if (sent > 0 || failed > 0) {
    await persistCreatorOutreachStoreToDb(supabase, store);
  }
  return { sent, failed, lastError, lastWarning };
}
async function processQueuedOutreachSends(supabase, options) {
  const limit = options?.limit ?? senderBatchSize();
  let sendIds = options?.sendIds;
  if (!sendIds) {
    const store = await loadCreatorOutreachStoreFromDb(supabase);
    sendIds = store.outreachSends.filter((s) => s.status === "queued").slice(0, limit).map((s) => s.id);
  } else {
    sendIds = sendIds.slice(0, limit);
  }
  const result = await processMissiveForSendIds(supabase, sendIds);
  return {
    claimed: sendIds.length,
    sent: result.sent,
    failed: result.failed,
    lastError: result.lastError,
    lastWarning: result.lastWarning
  };
}
export {
  processQueuedOutreachSends,
  readRuntimeEnv
};
