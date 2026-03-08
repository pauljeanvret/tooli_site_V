import { Hero } from '@/components/Hero'
import { Values } from '@/components/Values'
import { ProductShowcase } from '@/components/ProductShowcase'
import { HowItWorks } from '@/components/HowItWorks'
import { Stats } from '@/components/Stats'
import { Behind } from '@/components/Behind'
import { FAQ } from '@/components/FAQ'
import { ContactForm } from '@/components/ContactForm'
import { RevealSection } from '@/components/RevealSection'

export default function Home() {
  return (
    <>
      <RevealSection>
        <Hero />
      </RevealSection>
      <RevealSection>
        <Values />
      </RevealSection>
      <RevealSection>
        <ProductShowcase />
      </RevealSection>
      <RevealSection>
        <HowItWorks />
      </RevealSection>
      <RevealSection>
        <Stats />
      </RevealSection>
      <RevealSection>
        <FAQ />
      </RevealSection>
      <RevealSection>
        <Behind />
      </RevealSection>
      <RevealSection>
        <ContactForm />
      </RevealSection>
    </>
  )
}
