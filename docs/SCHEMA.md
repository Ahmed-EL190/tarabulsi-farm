# مخطط Firestore
كل المستندات: `archived`, `createdBy`, `createdAt`, `updatedAt`, (`updatedBy`)، ولا حذف نهائي.
- `milkTransactions` (Milk_Box + إنتاج + مبيعات + مصروفات): date, type, category, description, morningL, eveningL, liters, pricePerL, receipts/payments SYP/USD, net SYP/USD, method, fundingSource, partnerAmount, partnerCurrency, linkedLedgerId/linkedEventId, srcSheet/srcRow
- `landTransactions` (Transactions): code, date|null, stage, costType, category, subcategory, description, partner, amount, currency, status, detailLevel, source, attachmentUrl
- `cattle` (id = Animal_ID): animalId, name, category, status, purchaseDate/Price/currency, hasCalf, baselineMilkL, motherId, birthRaw, source, notes, health
- `cattleEvents`: animalId, type, date, amount, currency, linkedMilkId
- `partnerExpenses` (Partner-Depts): partner, type, amount, currency, reimbursement, milkRef
- `partnerLedger` (Partner_Ledger): date|null, partner, type, description, additionSYP, repaymentSYP, linkedMilkId
- `settings/lists`: {key:{items,disabled}} · `auditLogs` · `importJobs` (id = SHA-256 للملف)
مفتاح الاستيراد حتمي: `mb_<row>`, `tx_<row>`, `pd_<row>`, `pl_<row>` فلا تتكرر السجلات عند إعادة الاستيراد.
