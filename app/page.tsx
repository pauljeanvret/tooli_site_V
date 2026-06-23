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

export default function Home() {
  return (
    <div className="bg-toolia-bg-main">
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
  )
}
