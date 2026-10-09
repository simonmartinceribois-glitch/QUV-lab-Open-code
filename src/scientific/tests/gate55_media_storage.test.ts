/**
 * QUV-Lab — GATE 55 : Tests Media Storage (IndexedDB) — IDB-01 à IDB-23
 *
 * Valide l'architecture nouvelle de séparation média/métadonnées :
 *  - Conversion DataUri → Blob (base64 + utf8, décodage percent tolérant octet)
 *  - CRUD via MediaStoragePort (in-memory backend pour tests sync)
 *  - Hook MediaImageLoader (anti-race, revoke, isolation par état)
 *  - Migration idempotente / reprise / overlay / grand volume (100 refs)
 *  - Garbage collection (blob orphelin vs référencé)
 *  - sanitizeTrialForExport (sans binaire)
 *  - stableHash déterministe
 */
import {
  isLegacyStorageKey,
  convertDataUriToBlob,
  stableHash,
  createMigratedStorageKey,
  computeContentAddressedKey,
  runMediaMigration,
  deleteUnreferencedMedia,
  sanitizeTrialForExport
} from '../../services/mediaMigrationService';
import type { MediaStoragePort } from '../../services/mediaStorageService';
import { MediaImageLoader } from '../../hooks/mediaImageLogic';
import type { Trial, PhotoReference } from '../../types/trial';

type GateTestResult = { id: string; name: string; passed: boolean; expected: string; actual: string };
type GateTestSuite = { summary: { failed: number; total: number; passed: number }; results: GateTestResult[] };

// SVG production-représentatif DÉCODÉ (texte cible : octets UTF-8 attendus).
// Contient les marqueurs legacy qui faisaient échouer decodeURIComponent :
// '%' littéraux (0%, 100%) + %XX valides (%23 encodé) + Unicode (é, —).
const SVG_XML =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97706"/><stop offset="100%" stop-color="#78350f"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg)"/><text x="50" y="55" fill="#ffffff">Éprouvette 1 — A1 100%</text></svg>';

// Forme legacy historique : telle que persistée dans les trials existants
// (# encodé en %23, '%' des pourcentages laissés littéraux : 0%, 100%).
// C'est EXACTEMENT le payload qui provoquait `URIError: URI malformed`
// avant la Correction B (decodeURIComponent rejetait les '%' nus).
const SVG_KEY = `data:image/svg+xml;utf8,${SVG_XML.replace(/#/g, '%23')}`;
const JPEG_KEY = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';

// SVG legacy unique par index (contenu varié : vrai volume, clés déterministes
// distinctes, mêmes marqueurs legacy : 0%, 100%, %23, é, —).
function legacySvgKey(idx: number): string {
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><linearGradient id="g${idx}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/></linearGradient><text>Éprouvette ${idx} — ${idx}%</text></svg>`;
  return `data:image/svg+xml;utf8,${xml}`;
}

function createBaseTrial(id: string): Trial {
  return {
    id,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    metadata: {
      reference: `TRIAL-${id}`,
      title: 'Gate 55',
      createdBy: 'tester'
    },
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR'],
      familyConfigs: {} as any
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    batches: [],
    stages: [],
    mediaReferences: [],
    acquisitions: {},
    reports: [],
    auditTrail: []
  };
}

function makeRef(id: string, trialId: string, storageKey: string, overrides?: Partial<PhotoReference>): PhotoReference {
  return {
    id,
    trialId,
    type: 'PHOTO',
    status: 'ACTIVE',
    storageKey,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    capturedAt: '2026-01-01T00:00:00Z',
    capturedBy: 'tester',
    panelId: 'panel-1',
    stageId: 'stage-1',
    ...overrides
  };
}

function inMemoryBackend(): MediaStoragePort & { size: number } {
  const store = new Map<string, { blob: Blob; mimeType: string; createdAt: string }>();
  return {
    get size() { return store.size; },
    async put(file, key, mimeType) {
      const type = mimeType ?? file.type;
      if (!type) throw new Error('MIME manquant');
      store.set(key, { blob: file, mimeType: type, createdAt: new Date().toISOString() });
    },
    async get(key) { const r = store.get(key); return r ? { key, blob: r.blob, mimeType: r.mimeType, createdAt: r.createdAt } : null; },
    async delete(key) { store.delete(key); },
    async has(key) { return store.has(key); },
    async keys() { return [...store.keys()]; }
  };
}

export async function runGate55MediaStorageTests(): Promise<GateTestSuite> {
  const res: GateTestResult[] = [];

  async function blobText(blob: Blob): Promise<string> {
    return new TextDecoder('utf-8').decode(await blob.arrayBuffer());
  }

  async function blobHex(blob: Blob): Promise<string> {
    return Array.from(new Uint8Array(await blob.arrayBuffer()), (b) => b.toString(16).padStart(2, '0')).join(' ');
  }

  function toBase64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // IDB-01 : Conversion DataUri → Blob roundtrip
  {
    const { blob, mimeType } = convertDataUriToBlob(JPEG_KEY);
    const pass = mimeType === 'image/jpeg' && blob instanceof Blob && blob.type === 'image/jpeg' && blob.size > 0;
    res.push({ id: 'IDB-01', name: 'ConvertDataUriToBlob: Blob correct, mimeType, taille > 0', passed: pass, expected: 'mimeType=image/jpeg, size>0', actual: `mimeType=${mimeType}, size=${blob.size}` });
  }

  // IDB-02 : CRUD via MediaStoragePort
  {
    const b = inMemoryBackend();
    const testBlob = new Blob(['hello'], { type: 'text/plain' });
    await b.put(testBlob, 'k1', 'text/plain');
    const has1 = await b.has('k1');
    const rec = await b.get('k1');
    await b.delete('k1');
    const has2 = await b.has('k1');
    const pass = has1 && rec?.key === 'k1' && rec.mimeType === 'text/plain' && !has2;
    res.push({ id: 'IDB-02', name: 'CRUD in-memory: put→has→get→delete', passed: pass, expected: 'has=true, get.key=k1, has après delete=false', actual: `has=${has1}, get=${rec?.key}, has après delete=${has2}` });
  }

  // IDB-03 : MediaImageLoader anti-race
  {
    const slowStore = new Map<string, Blob>();
    slowStore.set('slow', new Blob(['S'], { type: 'text/plain' }));
    slowStore.set('fast', new Blob(['F'], { type: 'text/plain' }));
    const revoked: string[] = [];
    const loader = new MediaImageLoader({
      get: async (k) => {
        if (k === 'slow') await new Promise((r) => setTimeout(r, 50));
        const blob = slowStore.get(k);
        return blob ? { key: k, blob, mimeType: 'text/plain', createdAt: '' } : null;
      },
      createObjectURL: (blob) => `blob:${Date.now()}-${Math.random()}`,
      revokeObjectURL: (url) => { revoked.push(url); }
    });
    const [slow, fast] = await Promise.all([loader.resolve('slow'), loader.resolve('fast')]);
    // slow doit être obsolète (ignoré), fast doit être chargé.
    // Aucune URL révoquée car aucune URL n'existait avant (première résolution).
    const pass = slow.status === 'loading' && fast.status === 'loaded' && revoked.length === 0 && fast.url !== undefined;
    res.push({ id: 'IDB-03', name: 'MediaImageLoader: slow ignoré, fast chargé, première résolution sans révocation', passed: pass, expected: 'slow=loading, fast=loaded, revoked=0', actual: `slow=${slow.status}, fast=${fast.status}, revoked=${revoked.length}` });
    loader.reset();
  }

  // IDB-04 : Migration idempotente
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb04');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, SVG_KEY));
    let saved = 0;
    const s1 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => { saved++; } });
    const size1 = b.size;
    const k1 = t.mediaReferences[0].storageKey;
    const k2 = t.mediaReferences[1].storageKey;
    const s2 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => { saved++; } });
    const pass = s1.migrated === 2 && s1.errors === 0 && s1.remainingLegacy === 0 && s2.migrated === 0 && s2.errors === 0 && s2.remainingLegacy === 0 && b.size === 2 && k1.startsWith('media/') && k2.startsWith('media/') && k1 !== k2;
    res.push({ id: 'IDB-04', name: 'Migration idempotente: run1=2 migrés, run2=0 migrés (déjà fait), 2 blobs', passed: pass, expected: 's1.migrated=2, s2.migrated=0, size=2', actual: `s1=${s1.migrated}/${s1.errors}, s2=${s2.migrated}/${s2.errors}, size=${b.size}, k1=${k1}, k2=${k2}` });
  }

  // IDB-05 : Garbage collection
  {
    const b = inMemoryBackend();
    await b.put(new Blob(['ref']), 'media/ref', 'text/plain');
    await b.put(new Blob(['orphan']), 'media/orphan', 'text/plain');
    const t = createBaseTrial('idb05');
    t.mediaReferences.push(makeRef('r', t.id, 'media/ref'));
    const orphans = await deleteUnreferencedMedia(b, [t]);
    const pass = orphans.length === 1 && orphans[0] === 'media/orphan' && (await b.has('media/ref')) && !(await b.has('media/orphan'));
    res.push({ id: 'IDB-05', name: 'GC: orphelin supprimé, référencé préservé', passed: pass, expected: 'orphans=["media/orphan"]', actual: `orphans=${JSON.stringify(orphans)}` });
  }

  // IDB-06 : stableHash déterministe
  {
    const h1 = stableHash(JPEG_KEY);
    const h2 = stableHash(JPEG_KEY);
    const h3 = stableHash(SVG_KEY);
    const pass = h1 === h2 && h1.length === 16 && h1 !== h3 && /^[0-9a-f]{16}$/.test(h1);
    res.push({ id: 'IDB-06', name: 'stableHash: déterministe, 16 hex, uniques', passed: pass, expected: 'h1===h2, len=16, h1!==h3', actual: `h1=${h1}, h3=${h3}` });
  }

  // IDB-07 : Détection legacy vs clé logique
  {
    const pass = isLegacyStorageKey(JPEG_KEY) && isLegacyStorageKey(SVG_KEY) && !isLegacyStorageKey('media/abc') && !isLegacyStorageKey('photos/test.jpg');
    res.push({ id: 'IDB-07', name: 'isLegacyStorageKey: data:=true, media/:=false', passed: pass, expected: 'jpeg=true, svg=true, media=false, photos=false', actual: `${isLegacyStorageKey(JPEG_KEY)}, ${isLegacyStorageKey(SVG_KEY)}, ${isLegacyStorageKey('media/abc')}, ${isLegacyStorageKey('photos/test.jpg')}` });
  }

  // IDB-08 : put sans MIME lève une erreur
  {
    let threw = false;
    try {
      await inMemoryBackend().put(new Blob([]), 'k', undefined);
    } catch { threw = true; }
    res.push({ id: 'IDB-08', name: 'put sans MIME lève erreur', passed: threw, expected: 'exception', actual: threw ? 'OK' : 'aucune exception' });
  }

  // IDB-09 : overlay (ref archivée + active = même clé, 1 blob)
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb09');
    t.mediaReferences.push(makeRef('a', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('b', t.id, JPEG_KEY, { status: 'ARCHIVED' }));
    await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const ka = t.mediaReferences[0].storageKey;
    const kb = t.mediaReferences[1].storageKey;
    const pass = ka === kb && ka.startsWith('media/') && b.size === 1;
    res.push({ id: 'IDB-09', name: 'Overlay: refs actif/archivé = même clé, 1 seul blob', passed: pass, expected: 'ka===kb, size=1', actual: `ka=${ka}, kb=${kb}, size=${b.size}` });
  }

  // IDB-10 : Migration interrompue reprend
  {
    const b = inMemoryBackend();
    let fail = false;
    // Clé réelle produite par la migration (content-addressed, ou repli legacy
    // hors contexte sécurisé) : l'injection d'échec cible exactement cette clé.
    const jpegContentKey =
      (await computeContentAddressedKey(convertDataUriToBlob(JPEG_KEY).blob)) ??
      createMigratedStorageKey(JPEG_KEY);
    const failBackend: MediaStoragePort = {
      async put(file, key, mimeType) {
        if (fail && key === jpegContentKey) throw new Error('fail');
        return b.put(file, key, mimeType);
      },
      async get(k) { return b.get(k); },
      async delete(k) { return b.delete(k); },
      async has(k) { return b.has(k); },
      async keys() { return b.keys(); }
    };
    const t = createBaseTrial('idb10');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, SVG_KEY));

    fail = true;
    const s1 = await runMediaMigration({ backend: failBackend, trials: [t], saveTrial: () => {} });
    const r1k = t.mediaReferences[0].storageKey;
    const r2k = t.mediaReferences[1].storageKey;

    fail = false;
    const s2 = await runMediaMigration({ backend: failBackend, trials: [t], saveTrial: () => {} });
    const pass = s1.errors === 1 && r1k === JPEG_KEY && r2k.startsWith('media/') && s2.migrated === 1 && b.size === 2;
    res.push({ id: 'IDB-10', name: 'Migration reprise: échec→legacy, reprise→migré', passed: pass, expected: 's1.errors=1, r1=legacy, s2.migrated=1, size=2', actual: `s1=${s1.errors}, r1=${r1k}, r2=${r2k}, s2=${s2.migrated}, size=${b.size}` });
  }

  // IDB-11 : Référence partagée cross-trial = même blob
  {
    const b = inMemoryBackend();
    const t1 = createBaseTrial('idb11a');
    const t2 = createBaseTrial('idb11b');
    t1.mediaReferences.push(makeRef('r1', t1.id, JPEG_KEY));
    t2.mediaReferences.push(makeRef('r2', t2.id, JPEG_KEY));
    await runMediaMigration({ backend: b, trials: [t1, t2], saveTrial: () => {} });
    const pass = t1.mediaReferences[0].storageKey === t2.mediaReferences[0].storageKey && b.size === 1;
    res.push({ id: 'IDB-11', name: 'Cross-trial: même legacy → même clé, 1 seul blob', passed: pass, expected: 'k1===k2, size=1', actual: `k1=${t1.mediaReferences[0].storageKey}, k2=${t2.mediaReferences[0].storageKey}, size=${b.size}` });
  }

  // IDB-12 : sanitizeTrialForExport
  {
    const t = createBaseTrial('idb12');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, 'media/abc.jpg'));
    const s = sanitizeTrialForExport(t);
    const r1 = s.mediaReferences.find((r) => r.id === 'r1');
    const r2 = s.mediaReferences.find((r) => r.id === 'r2');
    const orig = t.mediaReferences[0].storageKey;
    const pass = r1?.storageKey.startsWith('media/') === true && r2?.storageKey === 'media/abc.jpg' && orig === JPEG_KEY;
    res.push({ id: 'IDB-12', name: 'sanitizeTrialForExport: legacy→clé, original intact', passed: pass, expected: 'r1=media/..., r2=media/abc.jpg, original=JPEG_KEY', actual: `r1=${r1?.storageKey}, r2=${r2?.storageKey}, orig=${orig}` });
  }

  // IDB-13 : SVG ASCII avec '%' littéraux (0%, 100%) — aucun URIError
  {
    const { blob, mimeType } = convertDataUriToBlob(
      'data:image/svg+xml;utf8,<svg width="2%"><rect fill="red" width="100%" height="0%"/></svg>'
    );
    const text = await blobText(blob);
    const pass = mimeType === 'image/svg+xml' && text === '<svg width="2%"><rect fill="red" width="100%" height="0%"/></svg>';
    res.push({ id: 'IDB-13', name: 'Décodage ASCII: "0%"/"100%" littéraux conservés, aucun URIError', passed: pass, expected: 'texte identique', actual: text });
  }

  // IDB-14 : %XX valides (%20, %23, %25, %C3%A9)
  {
    const { blob } = convertDataUriToBlob('data:image/svg+xml;utf8,a%20b%23c%25d%C3%A9');
    const text = await blobText(blob);
    const pass = text === 'a b#c%dé';
    res.push({ id: 'IDB-14', name: 'Décodage %XX: %20→espace, %23→#, %25→%, %C3%A9→é', passed: pass, expected: 'a b#c%dé', actual: text });
  }

  // IDB-15 : Unicode direct encodé UTF-8 — preuve octets (§21 du contrat)
  {
    const { blob } = convertDataUriToBlob('data:image/svg+xml;utf8,AéÉ—📷');
    // A=41, é=C3 A9, É=C3 89, —=E2 80 94, 📷=F0 9F 93 B7
    const expected = '41 c3 a9 c3 89 e2 80 94 f0 9f 93 b7';
    const actual = await blobHex(blob);
    const pass = actual === expected;
    res.push({ id: 'IDB-15', name: 'UTF-8 octets: A é É — 📷', passed: pass, expected, actual });
  }

  // IDB-16 : Mixte %XX valides + % littéral + Unicode — preuve octets (§21)
  {
    const { blob } = convertDataUriToBlob('data:image/svg+xml;utf8,100%25 + %23 + é');
    // 100%25→"100%", %23→"#", é→C3 A9 ; " + " littéraux → 20 2b 20
    const expected = '31 30 30 25 20 2b 20 23 20 2b 20 c3 a9';
    const actual = await blobHex(blob);
    const pass = actual === expected;
    res.push({ id: 'IDB-16', name: 'Mixte: "100%25 + %23 + é" → octets "100% + # + é"', passed: pass, expected, actual });
  }

  // IDB-17 : base64 (PNG/JPEG/SVG) décodé via atob — percent non appliqué
  {
    const b64Svg = toBase64Utf8('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="red" width="1" height="1"/></svg>');
    const checks = [
      { uri: 'data:image/svg+xml;base64,' + b64Svg, want: 'image/svg+xml', isSvg: true },
      { uri: 'data:image/png;base64,iVBORw0KGgo=', want: 'image/png', isSvg: false },
      { uri: JPEG_KEY, want: 'image/jpeg', isSvg: false }
    ];
    let pass = true;
    let actual = '';
    for (const c of checks) {
      const { blob, mimeType } = convertDataUriToBlob(c.uri);
      const text = await blobText(blob);
      pass &&= mimeType === c.want && blob.size > 0 && (c.isSvg ? text.includes('<svg') : !text.includes('<svg'));
      actual += `${c.want}=${mimeType};`;
    }
    res.push({ id: 'IDB-17', name: 'base64: PNG/JPEG/SVG décodés (atob), intégrité préservée', passed: pass, expected: 'mimeType conformes + contenu', actual });
  }

  // IDB-18 : Data URI malformée (sans virgule de séparation) → erreur EXPLICITE
  {
    const bad = ['not-a-data-uri', 'data:image/png;utf8<svg/>', 'data:image', ''];
    let pass = true;
    let actual = '';
    for (const uri of bad) {
      try {
        convertDataUriToBlob(uri);
        pass = false;
        actual += `aucune erreur pour <${uri}>; `;
      } catch {
        actual += `erreur pour <${uri}>; `;
      }
    }
    res.push({ id: 'IDB-18', name: 'Malformée sans virgule: erreur explicite (pas de donnée corrompue)', passed: pass, expected: '4 erreurs explicites', actual });
  }

  // IDB-19 : Équivalence production — legacy (%23 + % littéraux + Unicode) ≡ encodeURIComponent
  {
    const legacy = convertDataUriToBlob(SVG_KEY);
    const valid = convertDataUriToBlob(`data:image/svg+xml;utf8,${encodeURIComponent(SVG_XML)}`);
    const tLegacy = await blobText(legacy.blob);
    const tValid = await blobText(valid.blob);
    const pass = tLegacy === SVG_XML && tValid === SVG_XML && legacy.mimeType === 'image/svg+xml' && valid.mimeType === 'image/svg+xml';
    res.push({ id: 'IDB-19', name: 'Legacy (%23+%%+unicode) ≡ encodeURIComponent: identiques octets', passed: pass, expected: 'texte == SVG_XML des deux côtés', actual: `legacy=${tLegacy.slice(0, 50)}… valid=${tValid.slice(0, 50)}…` });
  }

  // IDB-20 : Migration idempotente d'un SVG production (0%, 100%, %23, é, —)
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb20');
    t.mediaReferences.push(makeRef('r1', t.id, SVG_KEY));
    const s1 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const rec = await b.get(t.mediaReferences[0].storageKey);
    const text = rec ? await blobText(rec.blob) : '';
    const s2 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const pass = s1.migrated === 1 && s1.errors === 0 && text === SVG_XML && s2.migrated === 0 && b.size === 1;
    res.push({ id: 'IDB-20', name: 'Migration SVG production: blob = SVG_XML exact, idempotent', passed: pass, expected: 'migrated=1, texte==SVG_XML, run2=0, size=1', actual: `s1=${s1.migrated}/${s1.errors}, run2=${s2.migrated}, size=${b.size}, text=${text.slice(0, 60)}…` });
  }

  // IDB-21 : Retry après échec de conversion — erreur isolée, reprise stable
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb21');
    t.mediaReferences.push(makeRef('r1', t.id, 'data:image/png;utf8<svg/>'));
    t.mediaReferences.push(makeRef('r2', t.id, JPEG_KEY));
    const s1 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const s2 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const pass =
      s1.errors === 1 && s1.migrated === 1 &&
      t.mediaReferences[0].storageKey === 'data:image/png;utf8<svg/>' &&
      t.mediaReferences[1].storageKey.startsWith('media/') &&
      s2.errors === 1 && s2.migrated === 0 && b.size === 1;
    res.push({ id: 'IDB-21', name: 'Retry: malformée reste legacy (erreur isolée), JPEG migré, reprise stable', passed: pass, expected: 's1: 1 erreur/1 migré; run2: 1 erreur/0; size=1', actual: `s1=${s1.errors}/${s1.migrated}, run2=${s2.errors}/${s2.migrated}, size=${b.size}` });
  }

  // IDB-22 : Grand volume — 100 refs (40 legacy SVG + 30 SVG encodés + 25 JPEG base64 + 5 malformés)
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb22');
    for (let i = 0; i < 40; i++) t.mediaReferences.push(makeRef(`l${i}`, t.id, legacySvgKey(i)));
    for (let i = 0; i < 30; i++) {
      const xml =
        `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><linearGradient id="pv${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97706"/></linearGradient><text>Éprouvette val ${i}</text></svg>`;
      t.mediaReferences.push(makeRef(`p${i}`, t.id, `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`));
    }
    for (let i = 0; i < 25; i++) t.mediaReferences.push(makeRef(`j${i}`, t.id, 'data:image/jpeg;base64,' + toBase64Utf8(`JPEG ${i}`)));
    for (let i = 0; i < 5; i++) t.mediaReferences.push(makeRef(`m${i}`, t.id, 'data:image/png;utf8<svg/>'));
    const s1 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const s2 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const pass =
      s1.examined === 100 && s1.migrated === 95 && s1.errors === 5 && s1.remainingLegacy === 5 &&
      s1.failedKeys.length === 5 && s2.examined === 5 && s2.migrated === 0 && s2.remainingLegacy === 5 && b.size === 95;
    res.push({ id: 'IDB-22', name: 'Grand volume 100 refs: 95 migrés, 5 erreurs isolées, 5 legacy, run2 idempotent', passed: pass, expected: 's1: 95/5/5, s2: 0/5/5, size=95', actual: `s1: ${s1.migrated}/${s1.errors}/${s1.remainingLegacy}, s2: ${s2.migrated}/${s2.errors}/${s2.remainingLegacy}, size=${b.size}` });
  }

  // IDB-23 : Chargement en masse MediaImageLoader — 100 médias, statuts isolés
  {
    const store = new Map<string, Blob>();
    for (let i = 0; i < 95; i++) store.set(`p${i}`, new Blob([`img${i}`], { type: 'image/jpeg' }));
    const created: string[] = [];
    const revoked: string[] = [];
    const results: string[] = [];
    for (let i = 0; i < 100; i++) {
      const key = i < 95 ? `p${i}` : i < 98 ? `m${i}` : `t${i}`;
      const loader = new MediaImageLoader({
        get: async (k) => {
          if (k.startsWith('t')) throw new Error('boom');
          const blob = store.get(k);
          return blob ? { key: k, blob, mimeType: 'image/jpeg', createdAt: '' } : null;
        },
        createObjectURL: (blob) => { const u = `blob:${created.length}-${blob.size}`; created.push(u); return u; },
        revokeObjectURL: (url) => { revoked.push(url); }
      });
      const st = await loader.resolve(key);
      results.push(st.status);
    }
    const loaded = results.filter((s) => s === 'loaded').length;
    const missing = results.filter((s) => s === 'missing').length;
    const errs = results.filter((s) => s === 'error').length;
    const pass = loaded === 95 && missing === 3 && errs === 2 && results.length === 100 && created.length === 95 && revoked.length === 0;
    res.push({ id: 'IDB-23', name: 'Masse 100 médias: 95 chargés, 3 missing, 2 error — aucun crash, URL isolées', passed: pass, expected: 'loaded=95, missing=3, error=2', actual: `loaded=${loaded}, missing=${missing}, error=${errs}, created=${created.length}, revoked=${revoked.length}` });
  }

  const failed = res.filter((r) => !r.passed).length;
  return { summary: { failed, total: res.length, passed: res.length - failed }, results: res };
}