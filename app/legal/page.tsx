import Link from 'next/link'

const contactEmail = 'tooliadev@gmail.com'

const legalItems = [
  ['Éditeur', 'Toolia — projet en cours d’immatriculation'],
  ['Responsable de publication', 'Paul Jeanvret'],
  ['Immatriculation', 'En cours'],
  ['Contact', contactEmail],
  ['Hébergement', 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis'],
]

export default function LegalPage() {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-6 py-16 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Mentions légales</p>
        <h1 className="text-3xl font-bold text-toolia-text md:text-5xl">Mentions légales</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-toolia-text-secondary">
          Informations de contact et d’hébergement du site Toolia.
        </p>

        <dl className="mt-10 overflow-hidden rounded-card border border-toolia-border-subtle bg-toolia-card">
          {legalItems.map(([label, value]) => (
            <div key={label} className="grid gap-2 border-b border-toolia-border-subtle p-5 last:border-b-0 md:grid-cols-[220px_1fr]">
              <dt className="text-sm font-semibold text-toolia-text">{label}</dt>
              <dd className="text-sm leading-6 text-toolia-text-secondary">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-toolia-text underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </div>
    </section>
  )
}
