// Run LOCALLY (never ship): node scripts/set-role.mjs <email> <admin|entry|viewer>
// Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service-account key stored OUTSIDE this repo.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
const [email, role] = process.argv.slice(2)
if (!email || !['admin', 'entry', 'viewer'].includes(role)) { console.error('usage: node scripts/set-role.mjs <email> <admin|entry|viewer>'); process.exit(1) }
initializeApp({ credential: applicationDefault() })
const u = await getAuth().getUserByEmail(email)
await getAuth().setCustomUserClaims(u.uid, { role })
console.log(`✔ ${email} => ${role}. The user must sign out and in again.`)
