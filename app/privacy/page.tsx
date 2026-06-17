import Link from 'next/link'

const contactEmail = 'tooliadev@gmail.com'
const lastUpdated = 'June 17, 2026'

const sections = [
  {
    title: 'Données utilisées pour fournir Toolia',
    body: 'Toolia utilise les données nécessaires au fonctionnement du service : compte utilisateur, configuration de vos catégories, statut de facturation, connexion Gmail, connexion Telegram si vous l’activez, usage mensuel et logs techniques utiles au suivi du service.',
  },
  {
    title: 'Connexion Gmail par Google OAuth',
    body: 'Toolia se connecte à Gmail via Google OAuth. Toolia ne vous demande jamais votre mot de passe Gmail. Vous choisissez les autorisations accordées et vous pouvez révoquer l’accès depuis votre compte Google à tout moment.',
  },
  {
    title: 'Utilisation des emails',
    body: 'Selon votre configuration, Toolia peut accéder à des métadonnées ou à du contenu d’emails uniquement pour classer les messages, créer ou vérifier des labels Gmail, préparer des brouillons, comprendre un fil de discussion ou déclencher une alerte. Toolia ne vend pas vos données email, ne les utilise pas pour de la publicité et les utilise uniquement pour fournir le service.',
  },
  {
    title: 'Brouillons et envoi',
    body: 'Toolia peut créer des brouillons dans Gmail. Toolia n’envoie pas automatiquement vos emails : vous gardez la validation finale et le contrôle de vos brouillons dans Gmail avant tout envoi.',
  },
  {
    title: 'Suppression et archivage',
    body: 'Toolia ne supprime pas définitivement vos emails. Certaines actions peuvent classer, labelliser ou préparer des traitements selon vos règles, mais la suppression définitive n’est pas une action prévue par le service.',
  },
  {
    title: 'IA et contexte utile',
    body: 'Pour classifier un email, préparer un brouillon ou résumer votre style d’écriture, Toolia peut transmettre à un fournisseur IA des extraits ou éléments de contexte utiles. Cette utilisation sert uniquement à fournir le service demandé.',
  },
  {
    title: 'Stripe et facturation',
    body: 'La facturation est gérée par Stripe. Toolia ne stocke pas vos numéros de carte bancaire. Les changements d’offre, annulations et moyens de paiement sont gérés dans le portail sécurisé Stripe.',
  },
  {
    title: 'Telegram',
    body: 'Telegram est optionnel. Si vous l’activez, Toolia l’utilise uniquement pour envoyer les alertes prévues par votre configuration et votre offre.',
  },
  {
    title: 'Vos droits',
    body: `Vous pouvez demander l’accès, la correction ou la suppression de vos données Toolia en écrivant à ${contactEmail}. Vous pouvez aussi révoquer l’accès Google depuis votre compte Google.`,
  },
]

const googleUserDataItems = [
  'Basic Google account information required for authentication, such as the user’s email address and profile information.',
  'Gmail data required to classify incoming emails, apply labels, identify important messages, and prepare draft replies.',
  'Gmail labels and draft-related information needed to operate the automation selected by the user.',
]

const protectionItems = [
  'Toolia uses HTTPS/TLS to protect data in transit.',
  'Google OAuth tokens and automation configuration data are handled server-side and are not exposed publicly in the browser.',
  'Access to production systems and stored data is restricted to authorized service operations.',
  'Secrets and API credentials are stored using environment variables or secure service configuration.',
  'Toolia avoids logging Gmail message content, OAuth tokens, passwords, or other sensitive Google user data.',
  'Analytics events do not include Gmail addresses, email content, Google tokens, message content, or user IDs.',
  'Human access to Google user data is not allowed except when necessary for security, debugging, legal compliance, or support requested by the user.',
]

const retentionItems = [
  'Toolia retains Google OAuth tokens and Gmail automation configuration only for as long as the user keeps their Toolia account active and their Gmail account connected.',
  'Gmail message content is processed to provide the automation features and is not permanently stored as a standalone archive by Toolia.',
  'Draft replies created by Toolia remain in the user’s Gmail account and are controlled by the user.',
  'Labels applied by Toolia remain in the user’s Gmail account and can be managed or removed by the user.',
  'Operational logs, if any, are kept only for security, debugging, and service reliability purposes and are deleted or overwritten within a reasonable period.',
]

const deletionItems = [
  'Users can disconnect Gmail from their Toolia dashboard, which stops Toolia from accessing the Gmail account.',
  'Users can also revoke Toolia’s access at any time from their Google Account permissions page.',
  'When a user disconnects Gmail or requests account deletion, Toolia deletes or deactivates the Google OAuth tokens associated with that account.',
  `Users can request deletion of their Toolia account and related Google user data by contacting: ${contactEmail}.`,
  'Deletion requests are processed within 30 days, unless retention is required for legal, security, or fraud-prevention reasons.',
]

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-toolia-text-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function PrivacyPage() {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-6 py-16 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Confidentialité</p>
        <h1 className="text-3xl font-bold text-toolia-text md:text-5xl">Politique de confidentialité</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-toolia-text-secondary">
          Cette page explique comment Toolia utilise les données nécessaires à l’automatisation Gmail, aux brouillons, aux alertes et à la facturation.
        </p>
        <p className="mt-3 text-sm font-semibold text-toolia-text-secondary">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-card border border-toolia-border-subtle bg-toolia-card p-6">
              <h2 className="text-xl font-semibold text-toolia-text">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">{section.body}</p>
            </article>
          ))}

          <article className="rounded-card border border-toolia-border-subtle bg-toolia-card p-6">
            <h2 className="text-xl font-semibold text-toolia-text">Google User Data: Protection, Retention and Deletion</h2>
            <div className="mt-4 space-y-6">
              <div>
                <p className="text-sm leading-7 text-toolia-text-secondary">
                  Toolia uses Google OAuth to let users connect their Gmail account to the Toolia service. Toolia only requests the permissions needed to provide its visible user-facing Gmail automation features.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Google user data accessed by Toolia may include:</h3>
                <BulletList items={googleUserDataItems} />
              </div>

              <div>
                <p className="text-sm leading-7 text-toolia-text-secondary">
                  Toolia uses Google user data only to provide and improve the Gmail automation features that the user has configured in the Toolia interface. Toolia does not sell Google user data, does not use Google user data for advertising, does not use Google user data for retargeting or personalized ads, and does not transfer Google user data to data brokers or advertising platforms.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Data protection mechanisms:</h3>
                <BulletList items={protectionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Retention:</h3>
                <BulletList items={retentionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Deletion:</h3>
                <BulletList items={deletionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Limited Use:</h3>
                <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">
                  Toolia’s use and transfer of information received from Google APIs complies with the Google API Services User Data Policy, including the Limited Use requirements.
                </p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-10 rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-6 text-sm leading-7 text-toolia-text-secondary">
          Contact confidentialité : <span className="font-semibold text-toolia-text">{contactEmail}</span>
        </div>

        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-toolia-text underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </div>
    </section>
  )
}
