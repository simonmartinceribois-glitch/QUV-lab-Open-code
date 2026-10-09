/**
 * QUV-Lab — Profil de session PROVISOIRE (avant la connexion serveur, D-13).
 *
 * Saisi une fois par navigateur ; il alimente automatiquement tous les champs
 * « Opérateur » (non modifiables) et le journal de bord. Aucun mot de passe :
 * ce n'est pas une authentification. Au premier lancement, la fenêtre est
 * obligatoire (impossible de travailler sans opérateur identifié).
 */
import React, { useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import type { Role, UserProfile } from '../types/auth';
import { ROLE_LABELS, validateUserProfile, formatOperatorLabel } from '../services/permissions';
import { setCurrentUser } from '../services/session';
import { generateUUID } from '../services/trialIds';

interface Props {
  current: UserProfile | null;
  /** Absent au premier lancement : la fenêtre ne peut pas être fermée sans profil. */
  onClose?: () => void;
}

export function SessionProfileDialog({ current, onClose }: Props) {
  const [firstName, setFirstName] = useState(current?.firstName ?? '');
  const [lastName, setLastName] = useState(current?.lastName ?? '');
  const [email, setEmail] = useState(current?.email ?? '');
  const [role, setRole] = useState<Role>(current?.role ?? 'TECHNICIEN');
  const [errors, setErrors] = useState<string[]>([]);

  const draft: UserProfile = {
    id: current?.id ?? generateUUID(),
    email: email.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role,
    active: true
  };

  const save = () => {
    const problems = validateUserProfile(draft, []);
    setErrors(problems);
    if (problems.length > 0) return;
    setCurrentUser(draft);
    onClose?.();
  };

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Profil de session">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          <h2 className="text-sm font-bold">{current ? 'Mon profil' : 'Identification de l’opérateur'}</h2>
        </div>
        <div className="p-6 space-y-3 text-xs text-slate-700">
          <p>
            Ce profil renseigne automatiquement l’opérateur de toutes les actions et du journal de bord.
            <span className="block mt-1 text-slate-500">
              Provisoire : il sera remplacé par la connexion (e-mail + mot de passe) de la version serveur.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="font-bold text-slate-600">Prénom</span>
              <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-600">Nom</span>
              <input className={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">E-mail</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@entreprise.fr" />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Rôle</span>
            <select className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          {firstName.trim() && lastName.trim() && (
            <p className="text-slate-500">
              Opérateur enregistré dans le journal : <strong className="text-slate-800">{formatOperatorLabel(draft)}</strong>
            </p>
          )}
          {errors.length > 0 && (
            <ul className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold list-disc list-inside">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          {onClose && (
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200">
              Annuler
            </button>
          )}
          <button type="button" onClick={save} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
