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
  'Les informations de base du compte Google nécessaires à l’authentification, comme l’adresse email et les informations de profil.',
  'Les données Gmail nécessaires pour classer les emails entrants, appliquer des labels, identifier les messages importants et préparer des brouillons de réponse.',
  'Les labels Gmail et les informations liées aux brouillons nécessaires au fonctionnement de l’automatisation choisie par l’utilisateur.',
]

const protectionItems = [
  'Toolia utilise HTTPS/TLS pour protéger les données en transit.',
  'Les jetons Google OAuth et les données de configuration d’automatisation sont traités côté serveur et ne sont pas exposés publiquement dans le navigateur.',
  'L’accès aux systèmes de production et aux données stockées est limité aux opérations de service autorisées.',
  'Les secrets et identifiants API sont stockés via des variables d’environnement ou des configurations de service sécurisées.',
  'Toolia évite de journaliser le contenu des messages Gmail, les jetons OAuth, les mots de passe ou d’autres données Google utilisateur sensibles.',
  'Les événements d’analyse n’incluent pas les adresses Gmail, le contenu des emails, les jetons Google, le contenu des messages ou les identifiants utilisateur.',
  'L’accès humain aux données Google utilisateur n’est autorisé que si cela est nécessaire pour la sécurité, le débogage, la conformité légale ou une demande de support initiée par l’utilisateur.',
]

const retentionItems = [
  'Toolia conserve les jetons Google OAuth et la configuration d’automatisation Gmail uniquement tant que l’utilisateur garde son compte Toolia actif et son compte Gmail connecté.',
  'Le contenu des messages Gmail est traité pour fournir les fonctionnalités d’automatisation et n’est pas stocké de façon permanente comme archive indépendante par Toolia.',
  'Les brouillons créés par Toolia restent dans le compte Gmail de l’utilisateur et sont contrôlés par l’utilisateur.',
  'Les labels appliqués par Toolia restent dans le compte Gmail de l’utilisateur et peuvent être gérés ou supprimés par l’utilisateur.',
  'Les logs opérationnels, le cas échéant, sont conservés uniquement pour la sécurité, le débogage et la fiabilité du service, puis supprimés ou remplacés dans un délai raisonnable.',
]

const deletionItems = [
  'Les utilisateurs peuvent déconnecter Gmail depuis leur dashboard Toolia, ce qui empêche Toolia d’accéder au compte Gmail.',
  'Les utilisateurs peuvent aussi révoquer l’accès de Toolia à tout moment depuis la page des autorisations de leur compte Google.',
  'Lorsqu’un utilisateur déconnecte Gmail ou demande la suppression de son compte, Toolia supprime ou désactive les jetons Google OAuth associés à ce compte.',
  `Les utilisateurs peuvent demander la suppression de leur compte Toolia et des données Google utilisateur associées en contactant : ${contactEmail}.`,
  'Les demandes de suppression sont traitées sous 30 jours, sauf si une conservation est nécessaire pour des raisons légales, de sécurité ou de prévention de la fraude.',
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
            <h2 className="text-xl font-semibold text-toolia-text">Données utilisateur Google : protection, conservation et suppression</h2>
            <div className="mt-4 space-y-6">
              <div>
                <p className="text-sm leading-7 text-toolia-text-secondary">
                  Toolia utilise Google OAuth pour permettre aux utilisateurs de connecter leur compte Gmail au service Toolia. Toolia demande uniquement les autorisations nécessaires pour fournir les fonctionnalités d’automatisation Gmail visibles et configurées par l’utilisateur.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Google user data accessed by Toolia may include:</h3>
                <BulletList items={googleUserDataItems} />
              </div>

              <div>
                <p className="text-sm leading-7 text-toolia-text-secondary">
                  Toolia utilise les données utilisateur Google uniquement pour fournir et améliorer les fonctionnalités d’automatisation Gmail configurées par l’utilisateur dans l’interface Toolia. Toolia ne vend pas les données utilisateur Google, ne les utilise pas pour la publicité, ne les utilise pas pour le reciblage ou les publicités personnalisées, et ne les transfère pas à des courtiers en données ou plateformes publicitaires.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Mécanismes de protection des données :</h3>
                <BulletList items={protectionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Conservation :</h3>
                <BulletList items={retentionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Suppression :</h3>
                <BulletList items={deletionItems} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-toolia-text">Utilisation limitée (Limited Use) :</h3>
                <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">
                  L’utilisation et le transfert par Toolia des informations reçues depuis les API Google respectent la Google API Services User Data Policy, y compris les exigences Limited Use.
                </p>
                <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">
                  Toolia n’utilise pas les données utilisateur Google pour entraîner, améliorer ou affiner des modèles généraux d’intelligence artificielle ou de machine learning. Les données utilisateur Google sont uniquement traitées pour fournir les fonctionnalités Gmail configurées par l’utilisateur, comme la classification des emails, l’application de labels, la détection de priorité et la préparation de brouillons.
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
