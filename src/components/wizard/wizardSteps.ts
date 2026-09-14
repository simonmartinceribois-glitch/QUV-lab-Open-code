/**
 * QUV-Lab — Liste des étapes visibles de l'assistant de création d'essai.
 *
 * R2 (audit 11-12/09/2026) : auparavant définie en dur et non exportée dans
 * CreateTrialWizardModal.tsx, empêchant tout contrôle réel du test UX 21
 * (« Assistant de Création en 7 Étapes »), qui retournait `pass: true` sans
 * vérifier quoi que ce soit.
 *
 * NOTE PRODUIT : l'étape 04 « Panneaux » (WizardStep4Panels.tsx) existe
 * toujours comme composant mais a été volontairement masquée du parcours
 * visible (le flux passe directement de l'étape 03 « Lots » à l'étape 05
 * « Plan de Mesure »), sur demande explicite du produit. Le parcours visible
 * comporte donc aujourd'hui 6 étapes, pas 7. Le composant WizardStep4Panels
 * est conservé pour permettre une réactivation future sans le réécrire.
 */
export interface WizardStepDescriptor {
  num: WizardStepNum;
  label: string;
}

/**
 * P4-c (audit 11-12/09/2026) : type partagé du numéro d'étape, remplaçant les
 * `as any` qui existaient sur setStep(...) dans CreateTrialWizardModal.tsx
 * (arithmétique step+1/step-1 et clic sur le stepper produisaient un simple
 * `number`, incompatible avec l'union littérale sans assertion large).
 */
export type WizardStepNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WIZARD_STEPS_LIST: WizardStepDescriptor[] = [
  { num: 1, label: '01 Identification' },
  { num: 2, label: '02 Caractéristiques' },
  { num: 3, label: '03 Lots' },
  { num: 5, label: '05 Plan de Mesure' },
  { num: 6, label: '06 Calendrier' },
  { num: 7, label: '07 Validation' }
];

/**
 * Tables de transition explicites (étape 04 volontairement sautée : 3 -> 5).
 * Remplacent l'arithmétique `step + 1` / `step - 1`, qui produit un `number`
 * générique incompatible avec l'union littérale WizardStepNum sans recourir à
 * `as any`.
 */
export const NEXT_WIZARD_STEP: Record<WizardStepNum, WizardStepNum> = {
  1: 2,
  2: 3,
  3: 5,
  4: 5,
  5: 6,
  6: 7,
  7: 7
};

export const PREVIOUS_WIZARD_STEP: Record<WizardStepNum, WizardStepNum> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 3,
  6: 5,
  7: 6
};
