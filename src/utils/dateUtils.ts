/**
 * QUV-Lab — Utilitaires de date civile locale (règle R9-DATE, cf.
 * docs/QUV_LAB_SCIENTIFIC_RULES.md §24 "Dates civiles locales — R9-DATE").
 *
 * Source canonique UNIQUE pour obtenir la date du jour au format YYYY-MM-DD
 * en fuseau LOCAL du poste opérateur (jamais UTC).
 *
 * Pourquoi : `new Date().toISOString().slice(0, 10)` calcule la date en UTC.
 * Pour un opérateur en horaire UTC+1/+2 (France), entre minuit et 1h/2h du
 * matin heure locale, cette méthode renvoie encore LA VEILLE — un décalage
 * d'un jour sur une date de calendrier scientifique (ex. date d'application,
 * date de début d'exposition T0). `toLocaleDateString('en-CA')` renvoie le
 * format YYYY-MM-DD dans le fuseau local du poste et ne souffre pas de ce
 * décalage.
 *
 * Toute saisie de date "aujourd'hui" par défaut dans l'application DOIT
 * utiliser cette fonction plutôt que de réimplémenter le calcul localement,
 * pour éviter la duplication qui a permis l'incohérence identifiée lors de
 * l'audit du 11-12/09/2026 (R3 : CreateTrialWizardModal.tsx corrigé,
 * Tab02LotsPanels.tsx resté sur l'ancien calcul UTC).
 */
export function getTodayLocalISODate(): string {
  return new Date().toLocaleDateString('en-CA');
}
