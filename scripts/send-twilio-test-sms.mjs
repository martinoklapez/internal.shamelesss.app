/**
 * Send a one-off test SMS via Twilio.
 *
 * Requires in .env.local:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   (your Twilio number, E.164 e.g. +14155551234)
 *
 * Usage:
 *   node scripts/send-twilio-test-sms.mjs
 *   node scripts/send-twilio-test-sms.mjs "+491771959189" "Hello from Shamelesss"
 *   npm run test:twilio-sms
 */
import { loadEnvLocal } from './load-env-local.mjs'

const env = loadEnvLocal()

const accountSid = env.TWILIO_ACCOUNT_SID?.trim()
const authToken = env.TWILIO_AUTH_TOKEN?.trim()
const fromNumber = env.TWILIO_PHONE_NUMBER?.trim()

const toNumber = (process.argv[2] ?? '+491771959189').trim()
const body =
  process.argv[3]?.trim() ??
  'Shamelesss Twilio test — if you received this, SMS is working.'

if (!accountSid || !authToken || !fromNumber) {
  console.error(
    'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER in .env.local'
  )
  process.exit(1)
}

const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

const form = new URLSearchParams({
  To: toNumber,
  From: fromNumber,
  Body: body,
})

console.log(`Sending SMS from ${fromNumber} to ${toNumber}…`)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: form.toString(),
})

const text = await res.text()
let data
try {
  data = JSON.parse(text)
} catch {
  data = { raw: text }
}

if (!res.ok) {
  console.error(`Twilio error HTTP ${res.status}`)
  console.error(JSON.stringify(data, null, 2))
  process.exit(1)
}

console.log('Sent successfully')
console.log(JSON.stringify({
  sid: data.sid,
  status: data.status,
  to: data.to,
  from: data.from,
  date_created: data.date_created,
}, null, 2))
