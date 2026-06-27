import { Hero } from '@/components/Hero'
import { Values } from '@/components/Values'
import { ProductShowcase } from '@/components/ProductShowcase'
import { HowItWorks } from '@/components/HowItWorks'
import { ProductDemoVideo } from '@/components/ProductDemoVideo'
import { Stats } from '@/components/Stats'
import { Behind } from '@/components/Behind'
import { FAQ } from '@/components/FAQ'
import { ContactForm } from '@/components/ContactForm'
import { AutomationMotionStrip } from '@/components/AutomationMotionStrip'
import { BrandFlowLines } from '@/components/BrandFlowLines'

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-[#F7F8FB] dark:bg-toolia-bg-main">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(37,99,235,0.09),transparent_30%),radial-gradient(circle_at_82%_44%,rgba(22,34,74,0.055),transparent_34%),linear-gradient(180deg,#F7F8FB_0%,#F8FAFC_48%,#EEF3FA_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.08),transparent_30%),radial-gradient(circle_at_82%_44%,rgba(14,165,233,0.055),transparent_34%),linear-gradient(180deg,#0D1117_0%,#101827_52%,#0D1117_100%)]" />
      <BrandFlowLines className="left-1/2 top-[88svh] h-[760px] w-[120vw] -translate-x-1/2" />
      <BrandFlowLines className="right-[-18vw] top-[255svh] h-[620px] w-[88vw] rotate-180 opacity-80" />
      <div className="relative z-10">
        <Hero />
        <HowItWorks />
        <Values />
        <ProductDemoVideo />
        <ProductShowcase />
        <AutomationMotionStrip className="py-8 sm:py-10" />
        <Stats />
        <FAQ />
        <Behind />
        <ContactForm />
      </div>
    </div>
  )
}
