# QUV-LAB v1.6.0 — GUIDE DE DÉPLOIEMENT & EXÉCUTION

## 1. Prérequis Système
- **Node.js :** Version 20.x LTS (version utilisée par la CI)
- **Gestionnaire de paquets :** npm (version 9+)
- **Navigateurs supportés :** Google Chrome (v110+), Mozilla Firefox (v110+), Microsoft Edge (v110+)

## 2. Commandes Opérationnelles Standard

### Installation des dépendances (lockfile versionné)
```bash
npm ci
```

### Validation des types et linting
```bash
npm run lint
```

### Exécution de la suite complète de tests de qualification (1051 tests)
```bash
npm test
```

### Construction de l'artefact de production
```bash
npm run build
```

### Prévisualisation locale de l'artefact de production
```bash
npm run preview
```

### Démarrage en mode développement local (Port 3000)
```bash
npm run dev
```
