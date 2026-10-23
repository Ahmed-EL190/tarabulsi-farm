import { doc, getDoc, setDoc, writeBatch, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { audit } from './db'
import { COL } from './collections'
import { mapWorkbook } from '../utils/importMap'
import { reconcile } from '../utils/excelParser'

export async function sha256(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('') }
export const getJob = async (id) => { const s = await getDoc(doc(db, COL.imports, id)); return s.exists() ? s.data() : null }

/** Idempotent, resumable import. Batches of 400; progress persisted after every batch. */
export async function runImport({ parsed, fileName, fileHash, onProgress }) {
  const jobId = fileHash.slice(0, 32); const { docs, lists } = mapWorkbook(parsed, jobId)
  const jobRef = doc(db, COL.imports, jobId); const prev = await getJob(jobId)
  let done = prev?.status === 'running' ? prev.written || 0 : 0
  await setDoc(jobRef, { fileName, fileHash, total: docs.length, written: done, status: 'running', startedBy: auth.currentUser?.uid, startedAt: serverTimestamp(), counts: reconcile(parsed).counts }, { merge: true })
  const meta = { archived: false, createdBy: auth.currentUser?.uid || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  try {
    for (let i = done; i < docs.length; i += 400) {
      const b = writeBatch(db); docs.slice(i, i + 400).forEach((d) => b.set(doc(db, d.col, d.id), { ...d.data, ...meta }))
      await b.commit(); done = Math.min(i + 400, docs.length); await setDoc(jobRef, { written: done }, { merge: true }); onProgress?.(done, docs.length)
    }
    if (Object.keys(lists).length) await setDoc(doc(db, 'settings', 'lists'), lists, { merge: true })
    await setDoc(jobRef, { status: 'complete', finishedAt: serverTimestamp() }, { merge: true })
    await audit('import', COL.imports, jobId, null, { fileName, total: docs.length })
  } catch (e) { await setDoc(jobRef, { status: 'interrupted', error: String(e.message || e) }, { merge: true }); throw e }
  return jobId
}

/** Reads imported docs back and recomputes totals so success means "reconciled", not just "written". */
export async function verifyImport(jobId, expected) {
  const get = async (c) => (await getDocs(query(collection(db, c), where('importJobId', '==', jobId)))).docs.map((d) => d.data())
  const [milk, land, pexp, ledger, cattle] = await Promise.all([COL.milk, COL.land, COL.partnerExpenses, COL.ledger, COL.cattle].map(get))
  const sum = (a, k, f = () => true) => a.filter(f).reduce((s, x) => s + (x[k] || 0), 0)
  const got = { milk: milk.length, land: land.length, partnerExpenses: pexp.length, ledger: ledger.length,
    receiptsSYP: sum(milk, 'receiptsSYP'), paymentsSYP: sum(milk, 'paymentsSYP'), landUSD: sum(land, 'amount', (x) => x.currency === 'USD'), landSYP: sum(land, 'amount', (x) => x.currency === 'SYP'),
    cattlePurchaseSYP: sum(cattle, 'purchasePrice', (x) => x.currency === 'SYP'), ledgerOpening: sum(ledger, 'additionSYP', (x) => x.type === 'رصيد افتتاحي') }
  const want = { milk: expected.counts.milk, land: expected.counts.land, partnerExpenses: expected.counts.partnerExpenses, ledger: expected.counts.ledger, receiptsSYP: expected.milk.receiptsSYP, paymentsSYP: expected.milk.paymentsSYP,
    landUSD: expected.land.USD, landSYP: expected.land.SYP, cattlePurchaseSYP: expected.cattle.purchaseSYP, ledgerOpening: expected.ledgerOpening }
  return Object.keys(want).map((k) => ({ check: k, expected: want[k], actual: got[k], ok: Math.abs(want[k] - got[k]) < 0.001 }))
}

const SHEET_COL = { milk: COL.milk, land: COL.land, cattle: COL.cattle, events: COL.cattleEvents, partnerExpenses: COL.partnerExpenses, ledger: COL.ledger, advances: COL.advances, workers: COL.workers, payroll: COL.payroll }
/** Restores documents from backup .xlsx files exported by this app (sheet name = key, column "id" = document id). */
export async function restoreBackup(files, onProgress) {
  const ExcelJS = (await import('exceljs')).default; const out = []; let done = 0
  for (const file of files) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer())
    for (const ws of wb.worksheets) {
      const colName = SHEET_COL[ws.name]; if (!colName) continue
      const head = ws.getRow(1).values.slice(1); const docs = []
      ws.eachRow((row, r) => { if (r === 1) return
        const o = {}; head.forEach((h, i) => { let v = row.getCell(i + 1).value; if (v && typeof v === 'object' && 'result' in v) v = v.result; if (v instanceof Date) v = v.toISOString().slice(0, 10); o[h] = v === undefined || v === '' ? null : v })
        const id = o.id; delete o.id; if (id) docs.push({ id: String(id), data: o }) })
      for (let i = 0; i < docs.length; i += 400) {
        const b = writeBatch(db); docs.slice(i, i + 400).forEach((d) => b.set(doc(db, colName, d.id), { ...d.data, archived: d.data.archived === true, updatedAt: serverTimestamp(), restoredBy: auth.currentUser?.uid || null }))
        await b.commit(); done += Math.min(400, docs.length - i); onProgress?.(done)
      }
      out.push({ sheet: ws.name, collection: colName, count: docs.length })
    }
  }
  await audit('import', COL.imports, 'restore', null, out)
  return out
}
