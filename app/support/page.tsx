import Link from 'next/link'

const contactEmail = 'tooliadev@gmail.com'

const topics = [
  'Compte Toolia',
  'Facturation Stripe',
  'Connexion Gmail',
  'Alertes Telegram',
  'Confidentialité / suppression des données',
]

export default function SupportPage() {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-6 py-16 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Support</p>
        <h1 className="text-3xl font-bold text-toolia-text md:text-5xl">Support Toolia</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-toolia-text-secondary">
          Pour une question sur votre compte, Gmail, Telegram, la facturation ou la confidentialité, contactez{' '}
          <span className="font-semibold text-toolia-text">{contactEmail}</span>
          .
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <div key={topic} className="rounded-card border border-toolia-border-subtle bg-toolia-card p-5 text-sm font-medium text-toolia-text">
              {topic}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-6 text-sm leading-7 text-toolia-text-secondary">
          Les paiements, changements d’offre et annulations se gèrent dans le portail sécurisé Stripe depuis votre tableau de bord Toolia.
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/#contact" className="inline-flex rounded-btn bg-toolia-primary px-5 py-3 text-sm font-semibold text-white">
            Contacter Toolia
          </Link>
          <Link href="/dashboard" className="inline-flex rounded-btn border border-toolia-border-subtle px-5 py-3 text-sm font-semibold text-toolia-text">
            Mon espace Toolia
          </Link>
        </div>
      </div>
    </section>
  )
}
