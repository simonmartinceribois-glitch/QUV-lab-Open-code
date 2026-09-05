import { runAllScientificTests } from './src/scientific/tests/scientificEngine.test';
import { runGate22RegressionTests } from './src/scientific/tests/gate22_regressions.test';
import { runAllAcceptanceTests } from './src/scientific/analysis/tests/acceptanceTests';
import { runGate31IntegrityTests } from './src/scientific/tests/gate31_integrity.test';
import { runGate32FunctionalTests } from './src/scientific/tests/gate32_functional.test';
import { runGate33ScientificMetrologyTests } from './src/scientific/tests/gate33_scientific_metrology.test';
import { runGate34NormativeReportingTests } from './src/scientific/tests/gate34_normative_reporting.test';
import { runGate40SystemValidationTests } from './src/scientific/tests/gate40_system_validation.test';
import { runGate50OperationalQualificationTests } from './src/scientific/tests/gate50_operational_qualification.test';
import { runGate52AdhesionTests } from './src/scientific/tests/gate52_adhesion.test';
import { runGate53MediaCreatorTests } from './src/scientific/tests/gate53_media_creator_integrity.test';
import { runGate54CalendarMeasurementPlanTests } from './src/scientific/tests/gate54_calendar_measurement_plan_integrity.test';
import { runGate56AdhesionWitnessTests } from './src/scientific/tests/gate56_adhesion_witness.test';
import { runGate57AdhesionTwoMeasurementsTests } from './src/scientific/tests/gate57_adhesion_two_measurements.test';
import { runGate58PersozAggregationTests } from './src/scientific/tests/gate58_persoz_aggregation.test';
import { runPersozWitnessLockTests } from './src/scientific/tests/persoz_witness_lock.test';

console.log('================================================================');
console.log('1. EXÉCUTION DE LA SUITE DE TESTS SCIENTIFIQUES GÉNÉRALE (44 TESTS)');
console.log('================================================================');
const suite1 = runAllScientificTests();
console.log(`Résultats Suite Générale : ${suite1.summary.passed} / ${suite1.summary.total} réussis.`);
if (suite1.summary.failed > 0) {
  console.error('Échecs détectés dans la suite générale :');
  suite1.results.filter((r) => !r.passed).forEach((r) => {
    console.error(`- Test #${r.id} [${r.name}]: attendu '${r.expected}', obtenu '${r.actual}'`);
  });
}

console.log('\n================================================================');
console.log('2. EXÉCUTION DE LA SUITE DE TESTS DE RÉGRESSION GATE 2.2 (7 TESTS)');
console.log('================================================================');
const suite2 = runGate22RegressionTests();
console.log(`Résultats Suite GATE 2.2 : ${suite2.summary.passed} / ${suite2.summary.total} réussis.`);
suite2.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('3. EXÉCUTION DES TESTS D\'ACCEPTATION AUTOMATISÉS (30 TESTS)');
console.log('================================================================');
const suite3 = runAllAcceptanceTests();
console.log(`Résultats Tests d'Acceptation : ${suite3.passedCount} / ${suite3.totalCount} réussis.`);
if (!suite3.allPassed) {
  suite3.results.filter((r) => !r.passed).forEach((r) => {
    console.error(`- Test #${r.id} [${r.code}]: attendu '${r.expected}', obtenu '${r.actual}'`);
  });
}

console.log('\n================================================================');
console.log('4. EXÉCUTION DES TESTS D\'INTÉGRITÉ DU MODÈLE DE DONNÉES GATE 3.1 (12 TESTS)');
console.log('================================================================');
const suite4 = runGate31IntegrityTests();
console.log(`Résultats Suite GATE 3.1 : ${suite4.summary.passed} / ${suite4.summary.total} réussis.`);
suite4.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('5. EXÉCUTION DES TESTS FONCTIONNELS & D\'INTÉGRATION GATE 3.2 (6 TESTS)');
console.log('================================================================');
const suite5 = runGate32FunctionalTests();
console.log(`Résultats Suite GATE 3.2 : ${suite5.summary.passed} / ${suite5.summary.total} réussis.`);
suite5.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('6. EXÉCUTION DES TESTS SCIENTIFIQUES & MÉTROLOGIQUES GATE 3.3 (23 TESTS)');
console.log('================================================================');
const suite6 = runGate33ScientificMetrologyTests();
console.log(`Résultats Suite GATE 3.3 : ${suite6.summary.passed} / ${suite6.summary.total} réussis.`);
suite6.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('7. EXÉCUTION DES TESTS NORMATIFS, RAPPORT & TRAÇABILITÉ GATE 3.4 (9 TESTS)');
console.log('================================================================');
const suite7 = runGate34NormativeReportingTests();
console.log(`Résultats Suite GATE 3.4 : ${suite7.summary.passed} / ${suite7.summary.total} réussis.`);
suite7.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('8. EXÉCUTION DE LA VALIDATION SYSTÈME & RECETTE GATE 4.0 (12 TESTS)');
console.log('================================================================');
const suite8 = runGate40SystemValidationTests();
console.log(`Résultats Suite GATE 4.0 : ${suite8.summary.passed} / ${suite8.summary.total} réussis.`);
suite8.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('9. EXÉCUTION DE LA QUALIFICATION OPÉRATIONNELLE GATE 5.0 (11 TESTS)');
console.log('================================================================');
const suite9 = runGate50OperationalQualificationTests();
console.log(`Résultats Suite GATE 5.0 : ${suite9.passed} / ${suite9.total} réussis.`);
suite9.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('10. EXÉCUTION DE LA VALIDATION GATE 5.2 — RÈGLE ADHÉSION (18 TESTS)');
console.log('================================================================');
const suite10 = runGate52AdhesionTests();
console.log(`Résultats Suite GATE 5.2 : ${suite10.summary.passed} / ${suite10.summary.total} réussis.`);
suite10.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 52 Adhérence] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('11. EXÉCUTION DE LA VALIDATION GATE 53 — INTÉGRITÉ CRÉATEUR & MÉDIAS (8 TESTS)');
console.log('================================================================');
const suite11 = runGate53MediaCreatorTests();
console.log(`Résultats Suite GATE 53 : ${suite11.summary.passed} / ${suite11.summary.total} réussis.`);
suite11.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 53 ${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('12. EXÉCUTION DE LA VALIDATION GATE 54 — CALENDRIER & PLAN DE MESURAGE (15 TESTS)');
console.log('================================================================');
const suite12 = runGate54CalendarMeasurementPlanTests();
console.log(`Résultats Suite GATE 54 : ${suite12.summary.passed} / ${suite12.summary.total} réussis.`);
suite12.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 54 ${r.category}] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('13. EXÉCUTION DE LA VALIDATION GATE 5.6 — RÉFÉRENCE T0 ADHÉSION TÉMOIN (4 TESTS)');
console.log('================================================================');
const suite13 = runGate56AdhesionWitnessTests();
console.log(`Résultats Suite GATE 5.6 : ${suite13.summary.passed} / ${suite13.summary.total} réussis.`);
suite13.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 56 Témoin] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('14. EXÉCUTION DE LA VALIDATION GATE 57 — ADHÉSION 2 MESURES/PANNEAU (30 TESTS)');
console.log('================================================================');
const suite14 = runGate57AdhesionTwoMeasurementsTests();
console.log(`Résultats Suite GATE 57 : ${suite14.summary.passed} / ${suite14.summary.total} réussis.`);
suite14.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 57 2-mesures] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('15. EXÉCUTION DE LA VALIDATION GATE 58 — AGRÉGATION PERSOZ (7 TESTS)');
console.log('================================================================');
const suite15 = runGate58PersozAggregationTests();
console.log(`Résultats Suite GATE 58 : ${suite15.summary.passed} / ${suite15.summary.total} réussis.`);
suite15.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Gate 58 Persoz] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

console.log('\n================================================================');
console.log('16. EXÉCUTION DU VERROU PERSOZ/TÉMOIN (15 TESTS)');
console.log('================================================================');
const suite16 = runPersozWitnessLockTests();
console.log(`Résultats Verrou PERSOZ/T : ${suite16.summary.passed} / ${suite16.summary.total} réussis.`);
suite16.results.forEach((r) => {
  console.log(`[${r.passed ? 'PASS ✓' : 'FAIL ✗'}] [Persoz Lock] ${r.id} - ${r.name}`);
  if (!r.passed) {
    console.error(`   Attendu: ${r.expected}`);
    console.error(`   Obtenu:  ${r.actual}`);
  }
});

const totalFailed =
  suite1.summary.failed +
  suite2.summary.failed +
  (suite3.totalCount - suite3.passedCount) +
  suite4.summary.failed +
  suite5.summary.failed +
  suite6.summary.failed +
  suite7.summary.failed +
  suite8.summary.failed +
  suite9.failed +
  suite10.summary.failed +
  suite11.summary.failed +
  suite12.summary.failed +
  suite13.summary.failed +
  suite14.summary.failed +
  suite15.summary.failed +
  suite16.summary.failed;
const totalCount =
  suite1.summary.total +
  suite2.summary.total +
  suite3.totalCount +
  suite4.summary.total +
  suite5.summary.total +
  suite6.summary.total +
  suite7.summary.total +
  suite8.summary.total +
  suite9.total +
  suite10.summary.total +
  suite11.summary.total +
  suite12.summary.total +
  suite13.summary.total +
  suite14.summary.total +
  suite15.summary.total +
  suite16.summary.total;

if (totalFailed > 0) {
  console.error(`\n❌ Échec total : ${totalFailed} tests ont échoué.`);
  process.exit(1);
} else {
  console.log(`\n🎉 TOUS LES TESTS SONT AU VERT ! Total : ${totalCount} tests validés.`);
  process.exit(0);
}


