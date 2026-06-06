import { AutomationProfile, GmailLabelResult } from './schemas'

export type ProcessingLog = {
  id: string
  created_at: string
  level: 'info' | 'warning' | 'error'
  message: string
}

export type StoredAutomation = {
  userId: string
  status: 'active' | 'active_test' | 'paused'
  subscriptionStatus: 'demo' | 'active' | 'inactive'
  gmailConnected: boolean
  profile: AutomationProfile
  labels: GmailLabelResult[]
  logs: ProcessingLog[]
  updatedAt: string
}

type StoreGlobal = typeof globalThis & {
  __tooliaDemoStore?: Map<string, StoredAutomation>
}

const storeGlobal = globalThis as StoreGlobal

function getStore() {
  if (!storeGlobal.__tooliaDemoStore) {
    storeGlobal.__tooliaDemoStore = new Map<string, StoredAutomation>()
  }

  return storeGlobal.__tooliaDemoStore
}

function makeLog(message: string, level: ProcessingLog['level'] = 'info'): ProcessingLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    created_at: new Date().toISOString(),
    level,
    message,
  }
}

export function storeAutomationProfile(
  userId: string,
  profile: AutomationProfile,
  labels: GmailLabelResult[],
  options: { testMode?: boolean } = {},
) {
  const current = getStore().get(userId)
  const logs = [
    makeLog('Configuration Toolia prête.'),
    makeLog(`${labels.length} labels Gmail préparés.`),
    makeLog('Automatisation activée avec validation des brouillons avant envoi.'),
    ...(current?.logs || []),
  ].slice(0, 20)

  const record: StoredAutomation = {
    userId,
    status: options.testMode ? 'active_test' : 'active',
    subscriptionStatus: 'demo',
    gmailConnected: false,
    profile,
    labels,
    logs,
    updatedAt: new Date().toISOString(),
  }

  getStore().set(userId, record)
  return record
}

export function updateAutomationStatus(userId: string, status: StoredAutomation['status']) {
  const current = getStore().get(userId)
  if (!current) return null

  const updated: StoredAutomation = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
    logs: [
      makeLog(status === 'active' || status === 'active_test' ? 'Automatisation reprise.' : 'Automatisation mise en pause.'),
      ...current.logs,
    ],
  }

  getStore().set(userId, updated)
  return updated
}

export function getAutomationRecord(userId: string) {
  return getStore().get(userId) || null
}

export function processActiveDemoUsers(secret?: string) {
  const requiredSecret = process.env.WORKER_SECRET
  if (requiredSecret && secret !== requiredSecret) {
    return {
      ok: false,
      processedUsers: 0,
      logs: [makeLog('Worker secret invalide.', 'error')],
    }
  }

  const activeRecords = [...getStore().values()].filter((record) => record.status === 'active' || record.status === 'active_test')
  const logs = activeRecords.map((record) =>
    makeLog(`Traitement de test: ${record.profile.categories.length} catégories prêtes pour ${record.userId}.`),
  )

  return {
    ok: true,
    processedUsers: activeRecords.length,
    logs,
  }
}
