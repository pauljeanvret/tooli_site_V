import { ChangePlanClient } from '@/components/saas/SaasFlow'

export default function BillingChangePlanPage({
  searchParams,
}: {
  searchParams?: { target?: string | string[] }
}) {
  const rawTarget = searchParams?.target
  const targetPlanId = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget

  return <ChangePlanClient targetPlanId={targetPlanId || null} />
}
