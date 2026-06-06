import Link from 'next/link'

const contactEmail = 'tooliadev@gmail.com'

const sections = [
  {
    title: 'Service Toolia',
    body: 'Toolia est un assistant d’automatisation Gmail. Le service peut créer des labels, analyser des emails, préparer des brouillons et envoyer des alertes Telegram selon votre offre et votre configuration.',
  },
  {
    title: 'Validation des brouillons',
    body: 'Toolia ne remplace pas votre jugement professionnel. Les brouillons doivent être relus et validés par l’utilisateur avant envoi. Par défaut, Toolia ne déclenche pas l’envoi automatique d’emails.',
  },
  {
    title: 'Classification et limites',
    body: 'Toolia s’efforce de classer les emails correctement, mais ne garantit pas une classification parfaite. Vous restez responsable de vérifier les actions importantes, notamment les brouillons, labels et alertes.',
  },
  {
    title: 'Abonnements et facturation',
    body: 'Les offres Toolia sont facturées via Stripe. Les paiements, changements d’offre, annulations et moyens de paiement sont gérés dans le portail de facturation Stripe.',
  },
  {
    title: 'Évolution du service',
    body: 'Toolia peut évoluer pendant la phase bêta : fonctionnalités, limites, interface, fréquence de traitement ou parcours utilisateur peuvent être ajustés pour améliorer le service.',
  },
  {
    title: 'Usages interdits',
    body: 'L’utilisateur ne doit pas utiliser Toolia pour du spam, une activité abusive, illégale, frauduleuse ou contraire aux règles de Google, Stripe, Telegram ou aux lois applicables.',
  },
  {
    title: 'Contact',
    body: `Pour toute question liée aux conditions d’utilisation, contactez ${contactEmail}.`,
  },
]

export default function TermsPage() {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-6 py-16 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Conditions</p>
        <h1 className="text-3xl font-bold text-toolia-text md:text-5xl">Conditions d’utilisation</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-toolia-text-secondary">
          Ces conditions résument les règles principales d’utilisation de Toolia pendant la phase bêta du service.
        </p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-card border border-toolia-border-subtle bg-toolia-card p-6">
              <h2 className="text-xl font-semibold text-toolia-text">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">{section.body}</p>
            </article>
          ))}
        </div>

        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-toolia-text underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </div>
    </section>
  )
}
