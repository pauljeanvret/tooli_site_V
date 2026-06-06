import type { AutomationCategory, AutomationProfile, OnboardingAnswers } from './schemas'

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isAutomationCategoryDraftEnabled(category: AutomationCategory) {
  return Boolean(category.actions.draft || category.draft_reply.enabled)
}

export function summarizeProfileCategoryActions(profile: AutomationProfile) {
  return profile.categories.map((category) => ({
    category: category.name,
    label: category.gmail_label,
    labelEnabled: Boolean(category.actions.label),
    draftEnabled: isAutomationCategoryDraftEnabled(category),
    archiveEnabled: Boolean(category.actions.archive),
    telegramEnabled: Boolean(category.actions.telegram),
  }))
}

export function findDraftConsistencyIssues(profile: AutomationProfile, answers: OnboardingAnswers | null | undefined) {
  if (!answers) return []

  const profileById = new Map(profile.categories.map((category) => [category.id, category]))
  const profileByName = new Map(profile.categories.map((category) => [normalizeName(category.name), category]))
  const issues: Array<{
    category: string
    expectedDraft: boolean
    profileDraft: boolean
  }> = []

  for (const answerCategory of answers.categories) {
    if (!answerCategory.selected) continue

    const profileCategory =
      profileById.get(answerCategory.key) ||
      profileByName.get(normalizeName(answerCategory.label))

    if (!profileCategory) continue

    const expectedDraft = Boolean(answerCategory.actions.draft)
    const profileDraft = isAutomationCategoryDraftEnabled(profileCategory)

    if (expectedDraft && !profileDraft) {
      issues.push({
        category: answerCategory.label,
        expectedDraft,
        profileDraft,
      })
    }
  }

  return issues
}
