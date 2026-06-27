import { getPlanLimits } from '@/lib/saas/plan-config'

export type DiagnosticPlan = 'starter' | 'pro' | 'premium'

export type DiagnosticStatus = 'new' | 'to_contact' | 'contacted' | 'converted' | 'not_interested'

export type DiagnosticFormValues = {
  first_name: string
  email: string
  age_range: string
  role: string
  company_size: string
  emails_per_day_range: string
  inbox_minutes_per_day: number
  main_pain: string
  organization_level: string
  monthly_income_range: string
  consent_to_contact: boolean
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  company_website?: string
}

export type DiagnosticResult = {
  emails_per_day_estimate: number
  monthly_income_estimate: number
  hourly_value: number
  hours_lost_per_month: number
  hours_lost_per_year: number
  cost_lost_per_month: number
  cost_lost_per_year: number
  recommended_plan: DiagnosticPlan
  recommendation_text: string
  recommended_plan_monthly_price: number
  roi_title: string
  roi_text: string
  roi_warning: boolean
}

export const diagnosticStatusOptions: Array<{ value: DiagnosticStatus; label: string }> = [
  { value: 'new', label: 'Nouveau' },
  { value: 'to_contact', label: 'À contacter' },
  { value: 'contacted', label: 'Contacté' },
  { value: 'converted', label: 'Converti' },
  { value: 'not_interested', label: 'Pas intéressé' },
]

export const planLabels: Record<DiagnosticPlan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  premium: 'Premium',
}

export const diagnosticOptions = {
  age_range: [
    'Moins de 18 ans',
    '18-24 ans',
    '25-34 ans',
    '35-44 ans',
    '45-54 ans',
    '55 ans et plus',
    'Je préfère ne pas répondre',
  ],
  role: [
    'Indépendant / freelance',
    "Dirigeant / chef d'entreprise",
    'Artisan / commerçant',
    'Commercial / relation client',
    'Assistant / administratif',
    'Salarié',
    'Autre',
  ],
  company_size: ['Seulement moi', '2-5 personnes', '6-20 personnes', '21-50 personnes', '50+ personnes'],
  emails_per_day_range: ['0-20', '21-50', '51-100', '101-200', '200+'],
  inbox_minutes_per_day: [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1h' },
    { value: 90, label: '1h30' },
    { value: 120, label: '2h' },
    { value: 180, label: '3h ou plus' },
  ],
  main_pain: [
    'Je perds du temps à trier mes emails',
    'Je rate parfois des emails importants',
    'Je réponds trop tard',
    'Je dois écrire trop de réponses répétitives',
    "J'ai trop de newsletters / pubs",
    'Je suis souvent interrompu par ma boîte mail',
    'Tout ça à la fois',
  ],
  organization_level: [
    'Boîte mail très organisée',
    'Quelques dossiers/labels',
    'Un peu en bazar',
    'Complètement ingérable',
  ],
  monthly_income_range: [
    'Moins de 1 000 €',
    '1 000-1 500 €',
    '1 500-2 000 €',
    '2 000-2 500 €',
    '2 500-3 000 €',
    '3 000-4 000 €',
    '4 000-5 000 €',
    '5 000 € et plus',
  ],
} as const

const emailsPerDayMidpoints: Record<string, number> = {
  '0-20': 10,
  '21-50': 35,
  '51-100': 75,
  '101-200': 150,
  '200+': 220,
}

const monthlyIncomeMidpoints: Record<string, number> = {
  'Moins de 1 000 €': 800,
  '1 000-1 500 €': 1250,
  '1 500-2 000 €': 1750,
  '2 000-2 500 €': 2250,
  '2 500-3 000 €': 2750,
  '3 000-4 000 €': 3500,
  '4 000-5 000 €': 4500,
  '5 000 € et plus': 5500,
}

export const WORKING_DAYS_PER_MONTH = 22
export const WORKING_HOURS_PER_MONTH = 151

function roundOne(value: number) {
  return Math.round(value * 10) / 10
}

function getRecommendation(input: {
  emailsPerDay: number
  inboxMinutesPerDay: number
  mainPain: string
  organizationLevel: string
}): { plan: DiagnosticPlan; text: string } {
  const premium =
    input.inboxMinutesPerDay >= 120 ||
    input.emailsPerDay > 100 ||
    input.mainPain === 'Tout ça à la fois' ||
    input.organizationLevel === 'Complètement ingérable'

  if (premium) {
    return {
      plan: 'premium',
      text: 'Premium est le plan le plus adapté techniquement si votre boîte mail demande une automatisation complète : priorités, labels, brouillons et alertes.',
    }
  }

  const pro =
    (input.inboxMinutesPerDay >= 31 && input.inboxMinutesPerDay <= 90) ||
    (input.emailsPerDay >= 36 && input.emailsPerDay <= 100) ||
    input.mainPain === 'Je rate parfois des emails importants' ||
    input.mainPain === 'Je réponds trop tard' ||
    input.mainPain === 'Je dois écrire trop de réponses répétitives'

  if (pro) {
    return {
      plan: 'pro',
      text: 'Pro est le meilleur équilibre technique pour un flux régulier : plus de labels, plus de brouillons et des alertes utiles.',
    }
  }

  return {
    plan: 'starter',
    text: 'Starter suffit techniquement pour reprendre le contrôle avec une automatisation simple, sans besoin d’alertes ou de règles avancées.',
  }
}

function getRoiAnalysis(input: {
  plan: DiagnosticPlan
  costLostPerMonth: number
  monthlyIncome: number
}) {
  const planPrice = getPlanLimits(input.plan).monthlyPrice
  const loss = Math.round(input.costLostPerMonth)
  const lossLabel = formatEuro(loss)
  const planLabel = planLabels[input.plan]
  const lowIncome = input.monthlyIncome < 1000

  if (planPrice > loss) {
    const incomeContext = lowIncome
      ? ' Avec votre niveau de revenu déclaré, cette nuance est importante :'
      : ''

    return {
      price: planPrice,
      title: 'À savoir sur la rentabilité',
      warning: true,
      text: `${planLabel} est adapté techniquement à votre volume et à vos besoins d’automatisation, mais votre perte financière estimée reste d’environ ${lossLabel}/mois, donc inférieure au prix du plan.${incomeContext} l’intérêt est surtout le confort, la charge mentale, la régularité des réponses et la réduction des oublis, plus qu’un retour financier immédiat.`,
    }
  }

  return {
    price: planPrice,
    title: 'Rentabilité estimée',
    warning: false,
    text: `Votre perte financière estimée est d’environ ${lossLabel}/mois. Le plan ${planLabel} reste cohérent financièrement si Toolia vous aide réellement à récupérer une partie de ce temps et à éviter les retards importants.`,
  }
}

export function calculateDiagnostic(input: DiagnosticFormValues): DiagnosticResult {
  const emailsPerDay = emailsPerDayMidpoints[input.emails_per_day_range] ?? 10
  const inboxMinutesPerDay = Number(input.inbox_minutes_per_day)
  const monthlyIncome = monthlyIncomeMidpoints[input.monthly_income_range] ?? 800
  const hourlyValue = monthlyIncome / WORKING_HOURS_PER_MONTH
  const hoursLostPerMonth = (inboxMinutesPerDay / 60) * WORKING_DAYS_PER_MONTH
  const costLostPerMonth = hoursLostPerMonth * hourlyValue
  const roundedCostLostPerMonth = Math.round(costLostPerMonth)
  const recommendation = getRecommendation({
    emailsPerDay,
    inboxMinutesPerDay,
    mainPain: input.main_pain,
    organizationLevel: input.organization_level,
  })
  const roi = getRoiAnalysis({
    plan: recommendation.plan,
    costLostPerMonth: roundedCostLostPerMonth,
    monthlyIncome,
  })

  return {
    emails_per_day_estimate: emailsPerDay,
    monthly_income_estimate: monthlyIncome,
    hourly_value: roundOne(hourlyValue),
    hours_lost_per_month: roundOne(hoursLostPerMonth),
    hours_lost_per_year: roundOne(hoursLostPerMonth * 12),
    cost_lost_per_month: roundedCostLostPerMonth,
    cost_lost_per_year: Math.round(costLostPerMonth * 12),
    recommended_plan: recommendation.plan,
    recommendation_text: recommendation.text,
    recommended_plan_monthly_price: roi.price,
    roi_title: roi.title,
    roi_text: roi.text,
    roi_warning: roi.warning,
  }
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getPlanSignupUrl(plan: DiagnosticPlan) {
  return `/signup?plan=${plan}`
}
