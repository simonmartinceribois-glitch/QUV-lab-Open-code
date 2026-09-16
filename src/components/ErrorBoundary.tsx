import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

/**
 * QUV-Lab — Error Boundary global
 *
 * Sans ce composant, la moindre exception de rendu React (bug d'affichage,
 * donnée inattendue, etc.) fait planter l'intégralité de l'application vers
 * un écran blanc, sans message ni recours pour l'opérateur — potentiellement
 * en pleine saisie d'un essai en cours.
 *
 * Ce composant intercepte ces erreurs, affiche un message explicite avec la
 * possibilité de recharger l'application, et journalise l'erreur en console
 * pour le diagnostic. Les données déjà persistées (IndexedDB pour les médias,
 * localStorage pour les métadonnées) ne sont pas affectées par ce mécanisme :
 * seul l'état d'affichage en mémoire est perdu.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('QUV-Lab — erreur applicative interceptée :', error, errorInfo.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-slate-900 border border-red-700/50 rounded-xl p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertOctagon className="w-6 h-6 text-red-500 flex-shrink-0" />
              <h1 className="text-lg font-bold">Une erreur inattendue est survenue</h1>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              L'application QUV-Lab a rencontré une erreur d'affichage et ne peut pas continuer
              dans son état actuel. Les données déjà enregistrées localement (IndexedDB pour les
              clichés, localStorage pour les métadonnées) restent disponibles après rechargement.
              Les <strong>dernières modifications non encore enregistrées</strong> peuvent en
              revanche être perdues.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Si le problème persiste après rechargement, notez le message technique ci-dessous et
              transmettez-le pour diagnostic.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 mb-4 overflow-auto max-h-40 text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
