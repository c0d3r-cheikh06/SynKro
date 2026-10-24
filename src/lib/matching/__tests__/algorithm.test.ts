import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateWeekPublicationReadiness,
  generateSmartWeekProposals,
  generateWeeklyMatching,
  HistoricalPair,
  makeCanonicalPairKey,
  MatchingStudent,
  validateMatchingResult,
} from "../algorithm";

function buildClassRoster(
  counts: Array<{ groupId: string; groupName: string; count: number }>
): MatchingStudent[] {
  const roster: MatchingStudent[] = [];
  for (const g of counts) {
    for (let i = 1; i <= g.count; i++) {
      const idx = String(i).padStart(2, "0");
      roster.push({
        id: `stu-${g.groupId}-${idx}`,
        firstName: `Prénom-${g.groupName}-${idx}`,
        lastName: `Nom-${idx}`,
        groupId: g.groupId,
        groupName: g.groupName,
      });
    }
  }
  return roster;
}

describe("Algorithme de jumelage Synkro — Contraintes fondamentales", () => {
  const standardClass = buildClassRoster([
    { groupId: "dut-info", groupName: "DUT INFO", count: 23 },
    { groupId: "dut-tr", groupName: "DUT TR", count: 23 },
    { groupId: "glsi", groupName: "GLSI", count: 8 },
    { groupId: "srt", groupName: "SRT", count: 8 },
    { groupId: "autres", groupName: "Autres", count: 6 },
  ]); // Total = 68 students (even, 68 * 3 / 2 = 102 pairs per week)

  it("1. Interdit strictement les jumelages au sein d'un même groupe et atteint 102 paires pour les 68 étudiants", () => {
    const res = generateWeeklyMatching({
      students: standardClass,
      historicalPairs: [],
      weekNumber: 1,
      seed: "synkro-test-week-1",
    });

    assert.equal(res.valid, true, `Erreurs: ${res.validationErrors.join(", ")}`);
    assert.equal(res.stats.totalActiveStudents, 68);
    assert.equal(res.stats.totalPairsGenerated, 102);
    assert.equal(res.stats.studentsWithFullTarget, 68);
    assert.equal(res.stats.repeatPairsCount, 0);

    const byId = new Map(standardClass.map((s) => [s.id, s]));
    for (const pair of res.pairs) {
      const a = byId.get(pair.studentAId)!;
      const b = byId.get(pair.studentBId)!;
      assert.notEqual(
        a.groupId,
        b.groupId,
        `Même groupe détecté: ${a.groupId}`
      );
      assert.ok(
        pair.studentAId < pair.studentBId,
        "Ordre canonique studentAId < studentBId requis"
      );
    }
  });

  it("2. Garantit 0 répétition et 3 partenaires/étudiant sur un cycle complet de 6 semaines (612 paires distinctes)", () => {
    const history: HistoricalPair[] = [];
    const globalSeen = new Set<string>();

    for (let week = 1; week <= 6; week++) {
      const res = generateWeeklyMatching({
        students: standardClass,
        historicalPairs: history,
        weekNumber: week,
        seed: `synkro-cycle-2026-w${week}`,
      });

      assert.equal(res.valid, true);
      assert.equal(
        res.stats.totalPairsGenerated,
        102,
        `Semaine ${week} devrait générer 102 paires`
      );
      assert.equal(
        res.stats.repeatPairsCount,
        0,
        `Semaine ${week} ne devrait avoir aucune répétition`
      );
      assert.equal(res.stats.studentsWithFullTarget, 68);

      for (const p of res.pairs) {
        const [, , key] = makeCanonicalPairKey(p.studentAId, p.studentBId);
        assert.equal(
          globalSeen.has(key),
          false,
          `Paire répétée détectée en semaine ${week}: ${key}`
        );
        globalSeen.add(key);
        history.push({
          studentAId: p.studentAId,
          studentBId: p.studentBId,
          weekNumber: week,
        });
      }
    }

    assert.equal(globalSeen.size, 6 * 102);
  });

  it("3. Garantit la reproductibilité exacte avec la même graine (generationSeed)", () => {
    const runA = generateWeeklyMatching({
      students: standardClass,
      historicalPairs: [],
      weekNumber: 2,
      seed: "reproducible-seed-42",
    });
    const runB = generateWeeklyMatching({
      students: standardClass,
      historicalPairs: [],
      weekNumber: 2,
      seed: "reproducible-seed-42",
    });

    assert.deepEqual(runA.pairs, runB.pairs);
  });

  it("4. Gère un effectif impair (ex: 67 étudiants) et signale la contrainte de parité des graphes", () => {
    const oddRoster = standardClass.slice(0, 67);
    const res = generateWeeklyMatching({
      students: oddRoster,
      historicalPairs: [],
      weekNumber: 1,
      seed: "odd-roster-seed",
    });

    assert.equal(res.valid, true);
    // floor(67 * 3 / 2) = 100 pairs => 66 students with 3 partners and 1 student with 2 partners
    assert.equal(res.stats.theoreticalMaxPairsThisWeek, 100);
    assert.equal(res.stats.totalPairsGenerated, 100);
    assert.equal(res.stats.studentsWithFullTarget, 66);
    assert.equal(res.stats.studentsWithPartialTarget, 1);
    assert.ok(
      res.stats.warnings.some((w) => w.code === "ODD_STUDENT_COUNT_PARITY"),
      "Doit signaler l'avertissement de parité"
    );
  });

  it("5. Détecte la dominance d'un groupe majoritaire (> 50% de la classe) et respecte le plafond mathématique", () => {
    const imbalancedRoster = buildClassRoster([
      { groupId: "g-dominant", groupName: "Groupe Dominant", count: 20 },
      { groupId: "g-minor", groupName: "Groupe Mineur", count: 5 },
    ]);

    const res = generateWeeklyMatching({
      students: imbalancedRoster,
      historicalPairs: [],
      weekNumber: 1,
      seed: "imbalanced-seed",
    });

    assert.equal(res.valid, true);
    // Only 5 students outside dominant group => max 5 * 3 = 15 pairs possible
    assert.equal(res.stats.theoreticalMaxPairsThisWeek, 15);
    assert.equal(res.stats.totalPairsGenerated, 15);
    assert.ok(
      res.stats.warnings.some((w) => w.code === "SINGLE_GROUP_DOMINANCE"),
      "Doit signaler la dominance d'un seul groupe"
    );
  });

  it("6. Le validateur rejette explicitement toute paire intra-groupe ou doublon", () => {
    const fakeInvalidPairs = [
      {
        studentAId: standardClass[0].id,
        studentBId: standardClass[1].id, // Same group (dut-info)
        isRepeat: false,
        previousWeeks: [],
      },
    ];
    const check = validateMatchingResult(fakeInvalidPairs, standardClass, 3);
    assert.equal(check.valid, false);
    assert.ok(
      check.errors.some((e) => e.includes("Violation de contrainte inter-groupes"))
    );
  });

  it("7. Conserve strictement les paires approuvées comme invariants immuables lors de régénérations partielles", () => {
    // 2 paires approuvées préalablement par l'administrateur
    const approvedPairs = [
      { studentAId: standardClass[0].id, studentBId: standardClass[30].id },
      { studentAId: standardClass[1].id, studentBId: standardClass[31].id },
    ];

    const runA = generateSmartWeekProposals({
      students: standardClass,
      historicalPairs: [],
      approvedPairs,
      excludedPairs: [],
      weekNumber: 1,
      seed: "seed-partial-run-A",
    });

    const runB = generateSmartWeekProposals({
      students: standardClass,
      historicalPairs: [],
      approvedPairs,
      excludedPairs: [],
      weekNumber: 1,
      seed: "seed-partial-run-B-different",
    });

    assert.equal(runA.valid, true);
    assert.equal(runB.valid, true);
    assert.equal(runA.allActivePairs.length, 102);
    assert.equal(runB.allActivePairs.length, 102);
    assert.equal(runA.approvedPairsCount, 2);
    assert.equal(runB.approvedPairsCount, 2);
    assert.equal(runA.newPendingPairsCount, 100);
    assert.equal(runB.newPendingPairsCount, 100);

    // Les 2 paires approuvées doivent être présentes à l'identique dans runA et runB
    for (const app of approvedPairs) {
      const foundA = runA.allActivePairs.some(
        (p) =>
          (p.studentAId === app.studentAId && p.studentBId === app.studentBId) ||
          (p.studentAId === app.studentBId && p.studentBId === app.studentAId)
      );
      const foundB = runB.allActivePairs.some(
        (p) =>
          (p.studentAId === app.studentAId && p.studentBId === app.studentBId) ||
          (p.studentAId === app.studentBId && p.studentBId === app.studentAId)
      );
      assert.equal(foundA, true, "Paire approuvée absente de la régénération A");
      assert.equal(foundB, true, "Paire approuvée absente de la régénération B");
    }
  });

  it("8. Exclut définitivement une paire rejetée du cycle et ne la repropose jamais", () => {
    const excludedPair = {
      studentAId: standardClass[2].id,
      studentBId: standardClass[32].id,
    };

    const run = generateSmartWeekProposals({
      students: standardClass,
      historicalPairs: [],
      approvedPairs: [],
      excludedPairs: [excludedPair],
      weekNumber: 1,
      seed: "seed-exclusion-test",
    });

    assert.equal(run.valid, true);
    assert.equal(run.allActivePairs.length, 102);

    const hasExcluded = run.allActivePairs.some(
      (p) =>
        (p.studentAId === excludedPair.studentAId &&
          p.studentBId === excludedPair.studentBId) ||
        (p.studentAId === excludedPair.studentBId &&
          p.studentBId === excludedPair.studentAId)
    );
    assert.equal(
      hasExcluded,
      false,
      "La paire exclue a été reproposée par l'algorithme !"
    );
  });

  it("9. Calcule exactement les places restantes par étudiant selon les paires déjà approuvées", () => {
    // Si l'étudiant 0 a 1 paire approuvée, il doit lui rester 2 places à pourvoir (sur targetK = 3)
    const approvedPairs = [
      { studentAId: standardClass[0].id, studentBId: standardClass[30].id },
    ];

    const run = generateSmartWeekProposals({
      students: standardClass,
      historicalPairs: [],
      approvedPairs,
      excludedPairs: [],
      weekNumber: 1,
      seed: "seed-slots-calc",
    });

    // Les étudiants de la paire approuvée ont 2 places résiduelles à pourvoir
    assert.equal(run.remainingSlotsByStudent[standardClass[0].id], 2);
    assert.equal(run.remainingSlotsByStudent[standardClass[30].id], 2);
    // Un étudiant sans paire approuvée a 3 places résiduelles
    assert.equal(run.remainingSlotsByStudent[standardClass[2].id], 3);

    // L'algorithme a comblé toutes les places manquantes
    assert.equal(run.missingSlotsCount, 0);
    assert.equal(run.complete, true);
    assert.equal(run.allActivePairs.length, 102);
  });

  it("10. Bloque la publication officielle si des paires sont en attente ou s'il manque des places", () => {
    // Cas A: 101 paires approuvées et 1 en attente => publication bloquée
    const approved101 = standardClass.slice(0, 101).map((s, idx) => ({
      studentAId: standardClass[idx % 34].id,
      studentBId: standardClass[34 + (idx % 34)].id,
    }));

    const pendingCheck = evaluateWeekPublicationReadiness({
      students: standardClass,
      approvedPairs: approved101.slice(0, 100),
      pendingPairs: [
        {
          studentAId: standardClass[0].id,
          studentBId: standardClass[35].id,
        },
      ],
      rejectedPairsCount: 0,
      excludedPairs: [],
      historicalPairs: [],
    });

    assert.equal(pendingCheck.ready, false);
    assert.ok(
      pendingCheck.reasons.some((r) => r.includes("en attente de validation"))
    );

    // Cas B: Tout est approuvé et valide (102 paires)
    const validRun = generateWeeklyMatching({
      students: standardClass,
      historicalPairs: [],
      weekNumber: 1,
      seed: "seed-ready-publish",
    });

    const readyCheck = evaluateWeekPublicationReadiness({
      students: standardClass,
      approvedPairs: validRun.pairs.map((p) => ({
        studentAId: p.studentAId,
        studentBId: p.studentBId,
      })),
      pendingPairs: [],
      rejectedPairsCount: 0,
      excludedPairs: [],
      historicalPairs: [],
    });

    assert.equal(readyCheck.ready, true);
    assert.equal(readyCheck.reasons.length, 0);
    assert.equal(readyCheck.approvedCount, 102);
    assert.equal(readyCheck.pendingCount, 0);
    assert.equal(readyCheck.remainingStudentSlots, 0);
  });
});
