import { Hero } from '@/components/Hero'
import { Values } from '@/components/Values'
import { ProductShowcase } from '@/components/ProductShowcase'
import { HowItWorks } from '@/components/HowItWorks'
import { ProductDemoVideo } from '@/components/ProductDemoVideo'
import { Stats } from '@/components/Stats'
import { Behind } from '@/components/Behind'
import { FAQ } from '@/components/FAQ'
import { ContactForm } from '@/components/ContactForm'
import { HomeIntroOverlay } from '@/components/HomeIntroOverlay'

export default function Home() {
  return (
    <div className="bg-toolia-bg-main">
      <HomeIntroOverlay />
      <Hero />
      <HowItWorks />
      <Values />
      <ProductDemoVideo />
      <ProductShowcase />
      <Stats />
      <FAQ />
      <Behind />
      <ContactForm />
    </div>
  )
}
