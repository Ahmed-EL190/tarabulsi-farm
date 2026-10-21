import { COL } from '../../services/db'
import { numOrNull } from '../../utils/docs'
export const landCfg = {
  title: 'الأرض والاستثمار (Transactions)', collection: COL.land, exportName: 'land_transactions', searchKeys: ['description', 'code', 'source', 'partner'],
  columns: [{ key: 'code', label: 'المعرّف' }, { key: 'date', label: 'التاريخ' }, { key: 'stage', label: 'المرحلة' }, { key: 'costType', label: 'نوع التكلفة' }, { key: 'category', label: 'التصنيف' }, { key: 'subcategory', label: 'الفرعي' },
    { key: 'description', label: 'الوصف' }, { key: 'partner', label: 'الشريك' }, { key: 'amount', label: 'المبلغ', num: true }, { key: 'currency', label: 'العملة' }, { key: 'status', label: 'الحالة' }, { key: 'detailLevel', label: 'المستوى' }, { key: 'source', label: 'المصدر' }],
  filters: [{ key: 'stage', label: 'المرحلة', listKey: 'stages' }, { key: 'costType', label: 'نوع التكلفة', listKey: 'costTypes' }, { key: 'category', label: 'التصنيف', listKey: 'landCategories' }, { key: 'subcategory', label: 'الفرعي', listKey: 'subcategories' },
    { key: 'partner', label: 'الشريك', listKey: 'partners' }, { key: 'currency', label: 'العملة', listKey: 'currencies' }, { key: 'status', label: 'الحالة', listKey: 'statuses' }, { key: 'detailLevel', label: 'المستوى', listKey: 'detailLevels' }],
  fields: [
    { name: 'code', label: 'المعرّف', type: 'text', hint: 'اتركه فارغاً لتوليد معرّف تلقائي' }, { name: 'date', label: 'التاريخ', type: 'date', hint: 'اتركه فارغاً إن كان غير معروف (لا يُخمَّن)' },
    { name: 'stage', label: 'المرحلة', type: 'select', listKey: 'stages', required: true }, { name: 'costType', label: 'نوع التكلفة', type: 'select', listKey: 'costTypes', required: true },
    { name: 'category', label: 'التصنيف', type: 'select', listKey: 'landCategories', required: true }, { name: 'subcategory', label: 'التصنيف الفرعي', type: 'select', listKey: 'subcategories' },
    { name: 'description', label: 'الوصف', type: 'text', required: true }, { name: 'partner', label: 'الشريك', type: 'select', listKey: 'partners', required: true },
    { name: 'amount', label: 'المبلغ', type: 'number', required: true }, { name: 'currency', label: 'العملة', type: 'select', listKey: 'currencies', required: true },
    { name: 'status', label: 'الحالة', type: 'select', listKey: 'statuses', required: true }, { name: 'detailLevel', label: 'مستوى السجل', type: 'select', listKey: 'detailLevels', required: true },
    { name: 'source', label: 'المصدر/المرجع', type: 'text' }, { name: 'attachment', label: 'مستند', type: 'file' }],
  defaults: { status: 'مؤكد', detailLevel: 'تفصيلي' },
  prepare: (v) => { const a = numOrNull(v.amount); if (a === null) throw new Error('المبلغ مطلوب'); return { ...v, amount: a, date: v.date || null, code: v.code || `L-${Date.now().toString(36).toUpperCase()}` } },
}
