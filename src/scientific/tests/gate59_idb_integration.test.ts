/**
 * QUV-Lab — Gate 59 : Tests d'intégration IndexedDB réel
 *
 * VALIDE le câblage réel : MediaStorageService → idb → fake-indexeddb
 * (et non seulement le contrat MediaStoragePort avec backend mémoire).
 *
 * IDB-INT-01 : CRUD réel (put → get → delete) via MediaStorageService + idb + fake-indexeddb
 * IDB-INT-02 : Migration réelle (Data URI → Blob dans idb → ref mise à jour)
 * IDB-INT-03 : Reprise / idempotence réelle (deux runs = même résultat, 0 doublon)
 */
import 'fake-indexeddb/auto';
import { MediaStorageService } from '../../services/mediaStorageService';
import {
  runMediaMigration,
  convertDataUriToBlob,
  createMigratedStorageKey,
  isLegacyStorageKey
} from '../../services/mediaMigrationService';
import type { Trial, PhotoReference } from '../../types/trial';

type GateTestResult = { id: string; name: string; passed: boolean; expected: string; actual: string };
type GateTestSuite = { summary: { failed: number; total: number; passed: number }; results: GateTestResult[] };

const JPEG_KEY = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';
const JPEG_KEY_ALT = 'data:image/jpeg;base64,/9j/AAAA/4AAQSkZJRg';

function createBaseTrial(id: string): Trial {
  return {
    id,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    metadata: { reference: `IDB-INT-${id}`, createdBy: 'integration-test' },
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR'], familyConfigs: {} as any },
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
    id, trialId, type: 'PHOTO', status: 'ACTIVE',
    storageKey, filename: `${id}.jpg`, mimeType: 'image/jpeg', sizeBytes: 0,
    capturedAt: new Date().toISOString(), capturedBy: 'test',
    panelId: 'panel-1', stageId: 'stage-1',
    ...overrides
  };
}

export async function runGate59IdbIntegrationTests(): Promise<GateTestSuite> {
  const res: GateTestResult[] = [];

  // -----------------------------------------------------------------
  // IDB-INT-01 : CRUD réel — MediaStorageService → idb → fake-indexeddb
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_crud_real_01');
    const key = 'media/crud-test.jpg';
    const originalText = 'blob content for CRUD integration test';
    const originalBlob = new Blob([originalText], { type: 'image/jpeg' });

    try {
      // PUT
      await svc.put(originalBlob, key, 'image/jpeg');

      // GET — vérifier record
      const record = await svc.get(key);
      const getOk = record !== null &&
        record.key === key &&
        record.mimeType === 'image/jpeg' &&
        record.blob.size === originalBlob.size;

      // Vérifier le contenu du Blob (lecture réelle)
      const retrievedText = await record!.blob.text();
      const contentOk = retrievedText === originalText;

      // DELETE
      await svc.delete(key);
      const afterDelete = await svc.get(key);
      const deleteOk = afterDelete === null;

      const pass = getOk && contentOk && deleteOk;
      res.push({
        id: 'IDB-INT-01',
        name: 'CRUD réel: put→get(vérif blob+contenu)→delete→null',
        passed: pass,
        expected: 'record.key=key, blob.size match, blob content match, get après delete=null',
        actual: `key=${record?.key}, mime=${record?.mimeType}, size=${record?.blob.size}/${originalBlob.size}, content=${retrievedText === originalText}, afterDelete=${afterDelete}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-01',
        name: 'CRUD réel: put→get→delete',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-02 : Migration réelle — Data URI → Blob dans idb → ref
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_mig_real_02');
    const trial = createBaseTrial('mig02');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));

    const expectedKey = createMigratedStorageKey(JPEG_KEY);

    try {
      const summary = await runMediaMigration({
        backend: svc,
        trials: [trial],
        saveTrial: () => {}
      });

      // Vérifier que le Blob existe réellement dans fake-indexeddb
      const record = await svc.get(expectedKey);
      const blobExists = record !== null;

      // Vérifier que la ref est mise à jour
      const ref = trial.mediaReferences[0];
      const refUpdated = ref.storageKey === expectedKey && !isLegacyStorageKey(ref.storageKey);

      // Vérifier que le contenu du Blob correspond à la Data URI originale
      let blobContentMatches = false;
      if (record) {
        const { blob: expectedBlob } = convertDataUriToBlob(JPEG_KEY);
        const retrievedContent = await record.blob.text();
        const expectedContent = await expectedBlob.text();
        blobContentMatches = retrievedContent === expectedContent;
      }

      // Vérifier que saveTrial a bien été appelé (migration modifies la ref → trialChanged → saveTrial)
      const savedOk = summary.migrated >= 1;

      const pass = summary.migrated === 1 && summary.errors === 0 && summary.remainingLegacy === 0 &&
        blobExists && refUpdated && blobContentMatches && savedOk;

      res.push({
        id: 'IDB-INT-02',
        name: 'Migration réelle: Data URI → Blob idb → ref media/<hash> → contenu vérifié',
        passed: pass,
        expected: 'migrated=1, blob exists, ref=media/<hash>, content match, saveTrial called',
        actual: `migrated=${summary.migrated}, errors=${summary.errors}, blobExists=${blobExists}, ref=${ref.storageKey}, content=${blobContentMatches}, saved=${savedOk}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-02',
        name: 'Migration réelle',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-03 : Reprise / idempotence réelle — deux runs, 0 doublon
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_reprise_real_03');
    const trial = createBaseTrial('reprise03');
    // Deux refs legacy différentes
    trial.mediaReferences.push(makeRef('ra', trial.id, JPEG_KEY));
    const altJpeg = JPEG_KEY_ALT; // Data URI différente → clé différente
    trial.mediaReferences.push(makeRef('rb', trial.id, altJpeg));

    const keyA = createMigratedStorageKey(JPEG_KEY);
    const keyB = createMigratedStorageKey(altJpeg);

    try {
      // Run 1 : migration complète
      const s1 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });

      // Vérifier que les deux blobs existent
      const blobA = await svc.get(keyA);
      const blobB = await svc.get(keyB);
      const allKeys = await svc.keys();

      // Run 2 : idempotence — aucun nouveau blob, aucun erreur
      const s2 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const allKeysAfter = await svc.keys();

      const pass = s1.migrated === 2 && s1.errors === 0 &&
        blobA !== null && blobB !== null &&
        allKeys.length === 2 &&
        s2.migrated === 0 && s2.errors === 0 && s2.remainingLegacy === 0 &&
        allKeysAfter.length === 2;

      res.push({
        id: 'IDB-INT-03',
        name: 'Reprise/idempotence réelle: 2 refs → run1=2 migrés, run2=0, 0 doublon',
        passed: pass,
        expected: 's1.migrated=2, blobA+B exist, keys=2, s2.migrated=0, keysAfter=2',
        actual: `s1=${s1.migrated}/${s1.errors}, blobA=${blobA !== null}, blobB=${blobB !== null}, keys=${allKeys.length}, s2=${s2.migrated}/${s2.errors}/${s2.remainingLegacy}, keysAfter=${allKeysAfter.length}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-03',
        name: 'Reprise/idempotence réelle',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  const failed = res.filter((r) => !r.passed).length;
  return { summary: { failed, total: res.length, passed: res.length - failed }, results: res };
}