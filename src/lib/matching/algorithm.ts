/**
 * Synkro — Global Inter-Group Matching Algorithm (v1.0.0)
 *
 * Ensures global graph consistency (undirected edges where studentAId < studentBId),
 * strict prohibition of same-group pairings, avoidance of historical repeats across
 * the 6-week cycle, fair distribution of degree (target = 3 partners/week),
 * deterministic reproducibility via seed, and mathematical feasibility reporting.
 */

export const ALGORITHM_VERSION = "synkro-global-k-factor-v1.0.0";

export interface MatchingStudent {
  id: string;
  firstName: string;
  lastName: string;
  groupId: string;
  groupName: string;
}

export interface HistoricalPair {
  studentAId: string;
  studentBId: string;
  weekNumber: number;
}

export interface GeneratedPair {
  studentAId: string;
  studentBId: string;
  isRepeat: boolean;
  previousWeeks: number[];
}

export interface GroupCoverageMetric {
  groupId: string;
  groupName: string;
  studentCount: number;
  eligibleOutGroupCount: number;
  maxReachableInCycle: number;
  theoreticalMaxCoverageRate: number; // 0..1
}

export interface MatchingConstraintWarning {
  code:
    | "ODD_STUDENT_COUNT_PARITY"
    | "SINGLE_GROUP_DOMINANCE"
    | "INSUFFICIENT_ELIGIBLE_PARTNERS"
    | "HISTORICAL_REPEAT_REQUIRED"
    | "UNASSIGNED_GROUP_EXCLUDED"
    | "SMALL_COHORT_SIZE";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export interface MatchingGenerationStats {
  algorithmVersion: string;
  seed: string;
  weekNumber: number;
  totalWeeksInCycle: number;
  targetPartnersPerWeek: number;
  totalActiveStudents: number;
  totalGroups: number;
  totalPairsGenerated: number;
  theoreticalMaxPairsThisWeek: number;
  repeatPairsCount: number;
  studentsWithFullTarget: number; // degree === target (3)
  studentsWithPartialTarget: number; // 1..target-1
  studentsWithZeroPartners: number; // 0
  degreeDistribution: Record<number, number>;
  interGroupMatrix: Record<string, Record<string, number>>;
  mathematicalLimitsExplanation: string;
  groupCoverageMetrics: GroupCoverageMetric[];
  warnings: MatchingConstraintWarning[];
  executionTimeMs: number;
}

export interface MatchingGenerationResult {
  pairs: GeneratedPair[];
  stats: MatchingGenerationStats;
  valid: boolean;
  validationErrors: string[];
}

export interface GenerateMatchingInput {
  students: MatchingStudent[];
  historicalPairs: HistoricalPair[];
  weekNumber: number;
  totalWeeksInCycle?: number;
  targetPartnersPerWeek?: number;
  seed?: string;
  restarts?: number;
}

/**
 * Canonical pair key ordering studentAId < studentBId lexicographically,
 * matching the Prisma schema convention.
 */
export function makeCanonicalPairKey(id1: string, id2: string): [string, string, string] {
  if (id1 < id2) {
    return [id1, id2, `${id1}::${id2}`];
  }
  return [id2, id1, `${id2}::${id1}`];
}

/**
 * Deterministic 32-bit FNV-1a string hash + Mulberry32 PRNG.
 */
export function createSeededRng(seedString: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle using seeded PRNG.
 */
function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Validates a set of generated pairs against all hard constraints of Synkro.
 */
export function validateMatchingResult(
  pairs: GeneratedPair[],
  students: MatchingStudent[],
  targetPartnersPerWeek = 3
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const studentMap = new Map<string, MatchingStudent>();
  for (const s of students) {
    studentMap.set(s.id, s);
  }

  const seenKeys = new Set<string>();
  const degrees = new Map<string, number>();

  for (const pair of pairs) {
    const { studentAId, studentBId } = pair;

    if (studentAId === studentBId) {
      errors.push(`Auto-jumelage interdit pour l'étudiant ${studentAId}.`);
      continue;
    }

    if (studentAId > studentBId) {
      errors.push(
        `Ordre canonique non respecté (${studentAId} > ${studentBId}).`
      );
    }

    const [, , key] = makeCanonicalPairKey(studentAId, studentBId);
    if (seenKeys.has(key)) {
      errors.push(`Doublon détecté dans la même semaine pour la paire ${key}.`);
    }
    seenKeys.add(key);

    const studentA = studentMap.get(studentAId);
    const studentB = studentMap.get(studentBId);

    if (!studentA || !studentB) {
      errors.push(
        `Étudiant inconnu dans la paire (${studentAId}, ${studentBId}).`
      );
      continue;
    }

    if (!studentA.groupId || !studentB.groupId) {
      errors.push(
        `Étudiant sans groupe affecté dans la paire (${studentAId}, ${studentBId}).`
      );
    }

    if (studentA.groupId === studentB.groupId) {
      errors.push(
        `Violation de contrainte inter-groupes : ${studentA.firstName} ${studentA.lastName} et ${studentB.firstName} ${studentB.lastName} appartiennent tous deux au groupe "${studentA.groupName}".`
      );
    }

    degrees.set(studentAId, (degrees.get(studentAId) ?? 0) + 1);
    degrees.set(studentBId, (degrees.get(studentBId) ?? 0) + 1);
  }

  for (const [studentId, deg] of degrees.entries()) {
    if (deg > targetPartnersPerWeek) {
      errors.push(
        `L'étudiant ${studentId} a reçu ${deg} partenaires (maximum autorisé : ${targetPartnersPerWeek}).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates an optimal global matching for a given week of a cycle.
 */
export function generateWeeklyMatching(
  input: GenerateMatchingInput
): MatchingGenerationResult {
  const startTime = Date.now();
  const targetK = input.targetPartnersPerWeek ?? 3;
  const totalWeeks = input.totalWeeksInCycle ?? 6;
  const weekNumber = input.weekNumber;
  const seed =
    input.seed?.trim() || `synkro-w${weekNumber}-${Date.now().toString(36)}`;
  const restarts = Math.max(1, input.restarts ?? 24);

  const warnings: MatchingConstraintWarning[] = [];

  // Filter out students without a valid groupId
  const validStudents = input.students.filter(
    (s) => Boolean(s.groupId && s.groupId.trim())
  );
  const excludedCount = input.students.length - validStudents.length;
  if (excludedCount > 0) {
    warnings.push({
      code: "UNASSIGNED_GROUP_EXCLUDED",
      severity: "WARNING",
      message: `${excludedCount} étudiant(s) sans groupe ont été exclus de la génération.`,
    });
  }

  // Sort students deterministically by id
  const sortedStudents = [...validStudents].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const N = sortedStudents.length;

  // Group counts
  const groupMap = new Map<
    string,
    { id: string; name: string; members: MatchingStudent[] }
  >();
  for (const s of sortedStudents) {
    const existing = groupMap.get(s.groupId);
    if (existing) {
      existing.members.push(s);
    } else {
      groupMap.set(s.groupId, {
        id: s.groupId,
        name: s.groupName,
        members: [s],
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Build historical lookup
  const historyByPair = new Map<string, number[]>();
  const historicalDegreeByStudent = new Map<string, number>();
  const historicalGroupCountByStudent = new Map<string, Map<string, number>>();
  const studentById = new Map<string, MatchingStudent>(
    sortedStudents.map((s) => [s.id, s])
  );

  for (const s of sortedStudents) {
    historicalDegreeByStudent.set(s.id, 0);
    historicalGroupCountByStudent.set(s.id, new Map());
  }

  for (const hp of input.historicalPairs) {
    if (hp.studentAId === hp.studentBId) continue;
    const [a, b, key] = makeCanonicalPairKey(hp.studentAId, hp.studentBId);
    const weeks = historyByPair.get(key) ?? [];
    if (!weeks.includes(hp.weekNumber)) {
      weeks.push(hp.weekNumber);
    }
    historyByPair.set(key, weeks);

    if (studentById.has(a) && studentById.has(b)) {
      historicalDegreeByStudent.set(
        a,
        (historicalDegreeByStudent.get(a) ?? 0) + 1
      );
      historicalDegreeByStudent.set(
        b,
        (historicalDegreeByStudent.get(b) ?? 0) + 1
      );
      const groupA = studentById.get(a)!.groupId;
      const groupB = studentById.get(b)!.groupId;
      const mapA = historicalGroupCountByStudent.get(a)!;
      const mapB = historicalGroupCountByStudent.get(b)!;
      mapA.set(groupB, (mapA.get(groupB) ?? 0) + 1);
      mapB.set(groupA, (mapB.get(groupA) ?? 0) + 1);
    }
  }

  // Analyze mathematical bounds
  const maxConnectionsInCycle = totalWeeks * targetK;
  const groupCoverageMetrics: GroupCoverageMetric[] = groups.map((g) => {
    const outGroupCount = N - g.members.length;
    const reachable = Math.min(outGroupCount, maxConnectionsInCycle);
    const rate =
      outGroupCount > 0
        ? Number((reachable / outGroupCount).toFixed(4))
        : 0;
    return {
      groupId: g.id,
      groupName: g.name,
      studentCount: g.members.length,
      eligibleOutGroupCount: outGroupCount,
      maxReachableInCycle: reachable,
      theoreticalMaxCoverageRate: rate,
    };
  });

  // Theoretical max edges in a multipartite graph with max degree targetK:
  // 1) Sum of degrees <= N * targetK => |E| <= floor((N * targetK) / 2)
  // 2) If largest group has size M > N - M, every edge must have at least one endpoint outside that group => |E| <= (N - M) * targetK
  const largestGroupSize = groups.reduce(
    (max, g) => Math.max(max, g.members.length),
    0
  );
  const parityMaxEdges = Math.floor((N * targetK) / 2);
  const multipartiteMaxEdges =
    largestGroupSize > N - largestGroupSize
      ? (N - largestGroupSize) * targetK
      : parityMaxEdges;
  const theoreticalMaxPairsThisWeek = Math.min(
    parityMaxEdges,
    multipartiteMaxEdges
  );

  if (N < 4 || groups.length < 2) {
    warnings.push({
      code: "SMALL_COHORT_SIZE",
      severity: "CRITICAL",
      message:
        groups.length < 2
          ? "Au moins 2 groupes distincts sont requis pour générer des jumelages inter-groupes."
          : `Effectif actif très réduit (${N} étudiants) : impossible d'attribuer ${targetK} partenaires distincts hors-groupe à chacun.`,
    });
  }

  if ((N * targetK) % 2 === 1 && N > 0) {
    warnings.push({
      code: "ODD_STUDENT_COUNT_PARITY",
      severity: "INFO",
      message: `L'effectif actif (${N}) multiplié par ${targetK} est impair (${N * targetK}). Par propriété des graphes non orientés (la somme des degrés est toujours paire), au moins un étudiant aura ${targetK - 1} jumeaux au lieu de ${targetK} cette semaine (plafond théorique : ${parityMaxEdges} paires).`,
    });
  }

  if (largestGroupSize > N - largestGroupSize && groups.length >= 2) {
    const dominant = groups.find((g) => g.members.length === largestGroupSize)!;
    warnings.push({
      code: "SINGLE_GROUP_DOMINANCE",
      severity: "WARNING",
      message: `Le groupe "${dominant.name}" (${largestGroupSize} étudiants) dépasse la somme de tous les autres groupes réunis (${N - largestGroupSize} étudiants). Le plafond mathématique inter-groupes est limité à ${multipartiteMaxEdges} paires cette semaine.`,
    });
  }

  for (const g of groupCoverageMetrics) {
    if (g.eligibleOutGroupCount > 0 && g.eligibleOutGroupCount < targetK) {
      warnings.push({
        code: "INSUFFICIENT_ELIGIBLE_PARTNERS",
        severity: "WARNING",
        message: `Les étudiants du groupe "${g.groupName}" n'ont que ${g.eligibleOutGroupCount} partenaire(s) hors-groupe disponible(s), ce qui est inférieur à l'objectif de ${targetK} par semaine.`,
      });
    }
  }

  const mathematicalLimitsExplanation =
    `Sur un cycle de ${totalWeeks} semaines à raison de ${targetK} jumeaux par semaine, un étudiant peut rencontrer au maximum ${maxConnectionsInCycle} camarades distincts (${totalWeeks} × ${targetK} = ${maxConnectionsInCycle}). ` +
    `Avec ${N} étudiants actifs répartis dans ${groups.length} groupe(s), un étudiant dispose de ${Math.max(0, N - largestGroupSize)} à ${Math.max(0, N - Math.min(...(groups.map((g) => g.members.length).length ? groups.map((g) => g.members.length) : [0])))} camarades hors de son propre groupe. ` +
    `Il est donc mathématiquement impossible qu'un étudiant rencontre 100 % des étudiants des autres groupes en ${totalWeeks} semaines lorsque l'effectif hors-groupe dépasse ${maxConnectionsInCycle} personnes. L'algorithme maximise la diversité inter-groupes et évite les répétitions.`;

  if (N < 2 || groups.length < 2) {
    const emptyStats: MatchingGenerationStats = {
      algorithmVersion: ALGORITHM_VERSION,
      seed,
      weekNumber,
      totalWeeksInCycle: totalWeeks,
      targetPartnersPerWeek: targetK,
      totalActiveStudents: N,
      totalGroups: groups.length,
      totalPairsGenerated: 0,
      theoreticalMaxPairsThisWeek: 0,
      repeatPairsCount: 0,
      studentsWithFullTarget: 0,
      studentsWithPartialTarget: 0,
      studentsWithZeroPartners: N,
      degreeDistribution: { 0: N },
      interGroupMatrix: {},
      mathematicalLimitsExplanation,
      groupCoverageMetrics,
      warnings,
      executionTimeMs: Date.now() - startTime,
    };
    return {
      pairs: [],
      stats: emptyStats,
      valid: true,
      validationErrors: [],
    };
  }

  // Build adjacency candidate list of all valid inter-group edges
  interface CandidateEdge {
    uIdx: number;
    vIdx: number;
    uId: string;
    vId: string;
    key: string;
    repeatCount: number;
    previousWeeks: number[];
  }

  const candidateEdges: CandidateEdge[] = [];
  const adjCandidates: number[][] = Array.from({ length: N }, () => []);

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const sA = sortedStudents[i];
      const sB = sortedStudents[j];
      if (sA.groupId === sB.groupId) continue; // Strictly forbidden
      const [, , key] = makeCanonicalPairKey(sA.id, sB.id);
      const prevWeeks = historyByPair.get(key) ?? [];
      const edgeIdx = candidateEdges.length;
      candidateEdges.push({
        uIdx: i,
        vIdx: j,
        uId: sA.id,
        vId: sB.id,
        key,
        repeatCount: prevWeeks.length,
        previousWeeks: prevWeeks,
      });
      adjCandidates[i].push(edgeIdx);
      adjCandidates[j].push(edgeIdx);
    }
  }

  const rng = createSeededRng(seed);

  let bestEdges: CandidateEdge[] = [];
  let bestScore = -Infinity;

  // Multi-start heuristic + augmenting swap repair
  for (let attempt = 0; attempt < restarts; attempt++) {
    const degree = new Int32Array(N);
    const selectedEdgeIndices = new Set<number>();
    const weeklyGroupSeen: Array<Map<string, number>> = Array.from(
      { length: N },
      () => new Map<string, number>()
    );

    const baseStudentOrder = seededShuffle(
      Array.from({ length: N }, (_, idx) => idx),
      rng
    );

    // Phase 1: Round-by-round lowest-degree-first assignment without repeats
    for (let allowRepeats = 0; allowRepeats <= 1; allowRepeats++) {
      let progress = true;
      while (progress) {
        progress = false;

        // Order students with degree < targetK by:
        // 1) lowest current weekly degree
        // 2) largest group size (hardest to place first)
        // 3) lowest historical cumulative matches (fairness)
        const needyStudents = baseStudentOrder
          .filter((idx) => degree[idx] < targetK)
          .sort((i, j) => {
            if (degree[i] !== degree[j]) return degree[i] - degree[j];
            const gSizeI = groupMap.get(sortedStudents[i].groupId)!.members.length;
            const gSizeJ = groupMap.get(sortedStudents[j].groupId)!.members.length;
            if (gSizeI !== gSizeJ) return gSizeJ - gSizeI;
            const histI = historicalDegreeByStudent.get(sortedStudents[i].id) ?? 0;
            const histJ = historicalDegreeByStudent.get(sortedStudents[j].id) ?? 0;
            return histI - histJ;
          });

        if (needyStudents.length === 0) break;

        for (const u of needyStudents) {
          if (degree[u] >= targetK) continue;

          const sU = sortedStudents[u];
          const histGroupU = historicalGroupCountByStudent.get(sU.id)!;
          const weekGroupU = weeklyGroupSeen[u];

          let bestEdgeIdx = -1;
          let bestCandidateEval = -Infinity;

          const shuffledIncidence = seededShuffle(adjCandidates[u], rng);
          for (const eIdx of shuffledIncidence) {
            if (selectedEdgeIndices.has(eIdx)) continue;
            const edge = candidateEdges[eIdx];
            const v = edge.uIdx === u ? edge.vIdx : edge.uIdx;
            if (degree[v] >= targetK) continue;

            if (allowRepeats === 0 && edge.repeatCount > 0) continue;

            const sV = sortedStudents[v];
            const histGroupV = historicalGroupCountByStudent.get(sV.id)!;
            const weekGroupV = weeklyGroupSeen[v];

            // Score candidate partner v:
            // - strongly penalize repeats
            // - prefer v with lower current degree
            // - prefer v from a group that u hasn't met this week or historically
            // - prefer v from larger groups to preserve flexibility
            let score = 0;
            score -= edge.repeatCount * 10000;
            score += (targetK - degree[v]) * 120;

            const uSeenVGroupThisWeek = weekGroupU.get(sV.groupId) ?? 0;
            const vSeenUGroupThisWeek = weekGroupV.get(sU.groupId) ?? 0;
            score -= (uSeenVGroupThisWeek + vSeenUGroupThisWeek) * 45;

            const uSeenVGroupHist = histGroupU.get(sV.groupId) ?? 0;
            const vSeenUGroupHist = histGroupV.get(sU.groupId) ?? 0;
            score -= (uSeenVGroupHist + vSeenUGroupHist) * 18;

            const vGroupSize = groupMap.get(sV.groupId)!.members.length;
            score += vGroupSize * 2;

            const histDegV = historicalDegreeByStudent.get(sV.id) ?? 0;
            score -= histDegV * 5;

            if (score > bestCandidateEval) {
              bestCandidateEval = score;
              bestEdgeIdx = eIdx;
            }
          }

          if (bestEdgeIdx !== -1) {
            selectedEdgeIndices.add(bestEdgeIdx);
            const chosen = candidateEdges[bestEdgeIdx];
            degree[chosen.uIdx]++;
            degree[chosen.vIdx]++;
            const gU = sortedStudents[chosen.uIdx].groupId;
            const gV = sortedStudents[chosen.vIdx].groupId;
            weeklyGroupSeen[chosen.uIdx].set(
              gV,
              (weeklyGroupSeen[chosen.uIdx].get(gV) ?? 0) + 1
            );
            weeklyGroupSeen[chosen.vIdx].set(
              gU,
              (weeklyGroupSeen[chosen.vIdx].get(gU) ?? 0) + 1
            );
            progress = true;
          }
        }
      }

      // Phase 2 (before allowing repeats): Augmenting 1-edge swap to connect two deficient vertices u, v
      // If u and v both have degree < targetK and share the same group (or already matched/repeated),
      // find an existing edge (x, y) such that (u, x) and (v, y) are both valid non-repeat edges!
      if (allowRepeats === 0) {
        let augmented = true;
        let guard = 0;
        while (augmented && guard < 40) {
          augmented = false;
          guard++;
          const deficient = baseStudentOrder.filter((idx) => degree[idx] < targetK);
          if (deficient.length < 2) break;

          outerAugment: for (let i = 0; i < deficient.length; i++) {
            for (let j = i + 1; j < deficient.length; j++) {
              const u = deficient[i];
              const v = deficient[j];
              if (degree[u] >= targetK || degree[v] >= targetK) continue;

              for (const existingIdx of Array.from(selectedEdgeIndices)) {
                const ex = candidateEdges[existingIdx];
                const x = ex.uIdx;
                const y = ex.vIdx;
                if (x === u || x === v || y === u || y === v) continue;

                // Try replacing (x, y) with (u, x) and (v, y)
                const uxEdgeIdx = adjCandidates[u].find((eIdx) => {
                  const e = candidateEdges[eIdx];
                  return (
                    !selectedEdgeIndices.has(eIdx) &&
                    e.repeatCount === 0 &&
                    (e.uIdx === x || e.vIdx === x)
                  );
                });
                const vyEdgeIdx = adjCandidates[v].find((eIdx) => {
                  const e = candidateEdges[eIdx];
                  return (
                    !selectedEdgeIndices.has(eIdx) &&
                    e.repeatCount === 0 &&
                    (e.uIdx === y || e.vIdx === y)
                  );
                });

                if (
                  uxEdgeIdx !== undefined &&
                  vyEdgeIdx !== undefined &&
                  uxEdgeIdx !== vyEdgeIdx
                ) {
                  selectedEdgeIndices.delete(existingIdx);
                  selectedEdgeIndices.add(uxEdgeIdx);
                  selectedEdgeIndices.add(vyEdgeIdx);
                  degree[u]++;
                  degree[v]++;
                  augmented = true;
                  break outerAugment;
                }
              }
            }
          }
        }
      }
    }

    // Evaluate full matching solution quality
    const currentEdges = Array.from(selectedEdgeIndices).map(
      (idx) => candidateEdges[idx]
    );
    const totalEdges = currentEdges.length;
    let repeatEdges = 0;
    let zeroDegCount = 0;
    let fullDegCount = 0;
    let groupDiversityScore = 0;

    for (const e of currentEdges) {
      if (e.repeatCount > 0) repeatEdges += e.repeatCount;
    }
    for (let i = 0; i < N; i++) {
      if (degree[i] === 0) zeroDegCount++;
      if (degree[i] === targetK) fullDegCount++;
      groupDiversityScore += weeklyGroupSeen[i].size;
    }

    const totalScore =
      totalEdges * 5000 -
      repeatEdges * 15000 -
      zeroDegCount * 20000 +
      fullDegCount * 300 +
      groupDiversityScore * 25;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestEdges = currentEdges;
      // Early exit if theoretical optimum reached with 0 repeats and maximum group diversity
      if (
        totalEdges === theoreticalMaxPairsThisWeek &&
        repeatEdges === 0 &&
        attempt >= 5
      ) {
        break;
      }
    }
  }

  // Sort final pairs deterministically by canonical key
  const finalPairs: GeneratedPair[] = bestEdges
    .map((e) => {
      const [studentAId, studentBId] = makeCanonicalPairKey(e.uId, e.vId);
      return {
        studentAId,
        studentBId,
        isRepeat: e.repeatCount > 0,
        previousWeeks: [...e.previousWeeks].sort((a, b) => a - b),
      };
    })
    .sort((a, b) =>
      a.studentAId !== b.studentAId
        ? a.studentAId.localeCompare(b.studentAId)
        : a.studentBId.localeCompare(b.studentBId)
    );

  // Compute final statistics
  const finalDegrees = new Map<string, number>();
  for (const s of sortedStudents) {
    finalDegrees.set(s.id, 0);
  }

  const interGroupMatrix: Record<string, Record<string, number>> = {};
  for (const g1 of groups) {
    interGroupMatrix[g1.name] = {};
    for (const g2 of groups) {
      interGroupMatrix[g1.name][g2.name] = 0;
    }
  }

  let repeatPairsCount = 0;
  for (const p of finalPairs) {
    finalDegrees.set(p.studentAId, (finalDegrees.get(p.studentAId) ?? 0) + 1);
    finalDegrees.set(p.studentBId, (finalDegrees.get(p.studentBId) ?? 0) + 1);
    if (p.isRepeat) repeatPairsCount++;

    const gA = studentById.get(p.studentAId)!.groupName;
    const gB = studentById.get(p.studentBId)!.groupName;
    interGroupMatrix[gA][gB] = (interGroupMatrix[gA][gB] ?? 0) + 1;
    interGroupMatrix[gB][gA] = (interGroupMatrix[gB][gA] ?? 0) + 1;
  }

  if (repeatPairsCount > 0) {
    warnings.push({
      code: "HISTORICAL_REPEAT_REQUIRED",
      severity: "WARNING",
      message: `${repeatPairsCount} paire(s) sur ${finalPairs.length} avaient déjà été jumelées lors d'une semaine antérieure en raison de la saturation des combinaisons sans répétition.`,
    });
  }

  const degreeDistribution: Record<number, number> = {};
  let studentsWithFullTarget = 0;
  let studentsWithPartialTarget = 0;
  let studentsWithZeroPartners = 0;

  for (const deg of finalDegrees.values()) {
    degreeDistribution[deg] = (degreeDistribution[deg] ?? 0) + 1;
    if (deg === targetK) studentsWithFullTarget++;
    else if (deg > 0) studentsWithPartialTarget++;
    else studentsWithZeroPartners++;
  }

  const validation = validateMatchingResult(
    finalPairs,
    sortedStudents,
    targetK
  );

  const stats: MatchingGenerationStats = {
    algorithmVersion: ALGORITHM_VERSION,
    seed,
    weekNumber,
    totalWeeksInCycle: totalWeeks,
    targetPartnersPerWeek: targetK,
    totalActiveStudents: N,
    totalGroups: groups.length,
    totalPairsGenerated: finalPairs.length,
    theoreticalMaxPairsThisWeek,
    repeatPairsCount,
    studentsWithFullTarget,
    studentsWithPartialTarget,
    studentsWithZeroPartners,
    degreeDistribution,
    interGroupMatrix,
    mathematicalLimitsExplanation,
    groupCoverageMetrics,
    warnings,
    executionTimeMs: Date.now() - startTime,
  };

  return {
    pairs: finalPairs,
    stats,
    valid: validation.valid,
    validationErrors: validation.errors,
  };
}

// ============================================================================
// SMART PARTIAL REGENERATION & PUBLICATION READINESS ENGINE (v2.0)
// ============================================================================

export interface SimplePair {
  studentAId: string;
  studentBId: string;
}

export interface GenerateSmartProposalsInput {
  students: MatchingStudent[];
  historicalPairs: HistoricalPair[];
  approvedPairs: SimplePair[];
  excludedPairs: SimplePair[];
  preferredPendingPairs?: SimplePair[];
  weekNumber: number;
  totalWeeksInCycle?: number;
  targetPartnersPerWeek?: number;
  forbidHistoricalRepeats?: boolean;
  seed?: string;
  restarts?: number;
}

export interface SmartProposalsResult {
  preservedApprovedPairs: SimplePair[];
  newPendingPairs: GeneratedPair[];
  allActivePairs: GeneratedPair[];
  remainingSlotsByStudent: Record<string, number>;
  totalRequiredPairs: number;
  approvedPairsCount: number;
  newPendingPairsCount: number;
  missingSlotsCount: number;
  complete: boolean;
  valid: boolean;
  validationErrors: string[];
  blockingReasons: string[];
  stats: MatchingGenerationStats;
}

export interface PublicationReadinessInput {
  students: MatchingStudent[];
  approvedPairs: SimplePair[];
  pendingPairs: SimplePair[];
  rejectedPairsCount: number;
  excludedPairs: SimplePair[];
  historicalPairs: HistoricalPair[];
  targetPartnersPerWeek?: number;
  forbidHistoricalRepeats?: boolean;
}

export interface PublicationReadinessReport {
  ready: boolean;
  reasons: string[];
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  remainingStudentSlots: number;
  requiredPairsCount: number;
}

/**
 * Generates or regenerates ONLY the missing weekly proposals while treating
 * all `approvedPairs` as immutable hard constraints and excluding all cycle
 * `excludedPairs` (rejected pairs) and forbidden historical repeats.
 */
export function generateSmartWeekProposals(
  input: GenerateSmartProposalsInput
): SmartProposalsResult {
  const startTime = Date.now();
  const targetK = input.targetPartnersPerWeek ?? 3;
  const totalWeeks = input.totalWeeksInCycle ?? 6;
  const weekNumber = input.weekNumber;
  const forbidHistoricalRepeats = input.forbidHistoricalRepeats ?? true;
  const seed =
    input.seed?.trim() ||
    `synkro-smart-w${weekNumber}-${Date.now().toString(36)}`;
  const restarts = Math.max(1, input.restarts ?? 28);

  const warnings: MatchingConstraintWarning[] = [];
  const blockingReasons: string[] = [];

  const validStudents = input.students
    .filter((s) => Boolean(s.groupId && s.groupId.trim()))
    .sort((a, b) => a.id.localeCompare(b.id));

  const unassignedCount = input.students.length - validStudents.length;
  if (unassignedCount > 0) {
    warnings.push({
      code: "UNASSIGNED_GROUP_EXCLUDED",
      severity: "WARNING",
      message: `${unassignedCount} étudiant(s) actif(s) sans ancienne classe affectée ne peuvent pas être inclus tant qu'une ancienne classe ne leur est pas attribuée.`,
    });
  }

  const N = validStudents.length;
  const studentIndexById = new Map<string, number>();
  const studentById = new Map<string, MatchingStudent>();
  validStudents.forEach((s, idx) => {
    studentIndexById.set(s.id, idx);
    studentById.set(s.id, s);
  });

  const groupMap = new Map<
    string,
    { id: string; name: string; members: MatchingStudent[] }
  >();
  for (const s of validStudents) {
    const g = groupMap.get(s.groupId);
    if (g) g.members.push(s);
    else groupMap.set(s.groupId, { id: s.groupId, name: s.groupName, members: [s] });
  }
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // 1. Canonicalize & lock all APPROVED pairs (never altered, never deleted, never double-counted)
  const approvedKeySet = new Set<string>();
  const preservedApprovedPairs: SimplePair[] = [];
  const approvedDegree = new Int32Array(N);
  const lockedGroupSeen: Array<Map<string, number>> = Array.from(
    { length: N },
    () => new Map<string, number>()
  );

  for (const raw of input.approvedPairs) {
    if (!raw.studentAId || !raw.studentBId || raw.studentAId === raw.studentBId) {
      continue;
    }
    const [a, b, key] = makeCanonicalPairKey(raw.studentAId, raw.studentBId);
    if (approvedKeySet.has(key)) continue;
    approvedKeySet.add(key);
    preservedApprovedPairs.push({ studentAId: a, studentBId: b });

    const idxA = studentIndexById.get(a);
    const idxB = studentIndexById.get(b);
    if (idxA !== undefined) approvedDegree[idxA]++;
    if (idxB !== undefined) approvedDegree[idxB]++;
    if (idxA !== undefined && idxB !== undefined) {
      const gA = validStudents[idxA].groupId;
      const gB = validStudents[idxB].groupId;
      lockedGroupSeen[idxA].set(gB, (lockedGroupSeen[idxA].get(gB) ?? 0) + 1);
      lockedGroupSeen[idxB].set(gA, (lockedGroupSeen[idxB].get(gA) ?? 0) + 1);
    }
  }

  preservedApprovedPairs.sort((p1, p2) =>
    p1.studentAId !== p2.studentAId
      ? p1.studentAId.localeCompare(p2.studentAId)
      : p1.studentBId.localeCompare(p2.studentBId)
  );

  // 2. Calculate simultaneous remaining slots for every student (Partie 4.2)
  const remainingSlotsByStudent: Record<string, number> = {};
  const residualNeed = new Int32Array(N);
  let totalRemainingStudentSlots = 0;

  for (let i = 0; i < N; i++) {
    const s = validStudents[i];
    const rem = Math.max(0, targetK - approvedDegree[i]);
    residualNeed[i] = rem;
    remainingSlotsByStudent[s.id] = rem;
    totalRemainingStudentSlots += rem;
    if (approvedDegree[i] > targetK) {
      blockingReasons.push(
        `L'étudiant ${s.firstName} ${s.lastName} possède déjà ${approvedDegree[i]} paires validées (maximum : ${targetK}).`
      );
    }
  }

  // 3. Build cycle-scoped exclusion set & historical set
  const excludedKeySet = new Set<string>();
  for (const ex of input.excludedPairs) {
    if (!ex.studentAId || !ex.studentBId || ex.studentAId === ex.studentBId) {
      continue;
    }
    const [, , key] = makeCanonicalPairKey(ex.studentAId, ex.studentBId);
    excludedKeySet.add(key);
  }

  const preferredPendingKeySet = new Set<string>();
  for (const pp of input.preferredPendingPairs ?? []) {
    if (!pp.studentAId || !pp.studentBId || pp.studentAId === pp.studentBId) {
      continue;
    }
    const [, , key] = makeCanonicalPairKey(pp.studentAId, pp.studentBId);
    if (!approvedKeySet.has(key) && !excludedKeySet.has(key)) {
      preferredPendingKeySet.add(key);
    }
  }

  const historyByPair = new Map<string, number[]>();
  const historicalDegreeByStudent = new Map<string, number>();
  const historicalGroupCountByStudent = new Map<string, Map<string, number>>();
  for (const s of validStudents) {
    historicalDegreeByStudent.set(s.id, 0);
    historicalGroupCountByStudent.set(s.id, new Map());
  }

  for (const hp of input.historicalPairs) {
    if (hp.studentAId === hp.studentBId) continue;
    const [a, b, key] = makeCanonicalPairKey(hp.studentAId, hp.studentBId);
    const weeks = historyByPair.get(key) ?? [];
    if (!weeks.includes(hp.weekNumber)) weeks.push(hp.weekNumber);
    historyByPair.set(key, weeks);

    if (studentById.has(a) && studentById.has(b)) {
      historicalDegreeByStudent.set(
        a,
        (historicalDegreeByStudent.get(a) ?? 0) + 1
      );
      historicalDegreeByStudent.set(
        b,
        (historicalDegreeByStudent.get(b) ?? 0) + 1
      );
      const gA = studentById.get(a)!.groupId;
      const gB = studentById.get(b)!.groupId;
      const mA = historicalGroupCountByStudent.get(a)!;
      const mB = historicalGroupCountByStudent.get(b)!;
      mA.set(gB, (mA.get(gB) ?? 0) + 1);
      mB.set(gA, (mB.get(gA) ?? 0) + 1);
    }
  }

  const maxConnectionsInCycle = totalWeeks * targetK;
  const groupCoverageMetrics: GroupCoverageMetric[] = groups.map((g) => {
    const outGroupCount = N - g.members.length;
    const reachable = Math.min(outGroupCount, maxConnectionsInCycle);
    const rate =
      outGroupCount > 0 ? Number((reachable / outGroupCount).toFixed(4)) : 0;
    return {
      groupId: g.id,
      groupName: g.name,
      studentCount: g.members.length,
      eligibleOutGroupCount: outGroupCount,
      maxReachableInCycle: reachable,
      theoreticalMaxCoverageRate: rate,
    };
  });

  const largestGroupSize = groups.reduce(
    (max, g) => Math.max(max, g.members.length),
    0
  );
  const parityMaxEdges = Math.floor((N * targetK) / 2);
  const multipartiteMaxEdges =
    largestGroupSize > N - largestGroupSize
      ? (N - largestGroupSize) * targetK
      : parityMaxEdges;
  const theoreticalMaxPairsThisWeek = Math.min(
    parityMaxEdges,
    multipartiteMaxEdges
  );
  const totalRequiredPairs = parityMaxEdges;

  if (N < 4 || groups.length < 2) {
    const msg =
      groups.length < 2
        ? "Au moins deux anciennes classes actives sont requises pour former des paires entre anciennes classes."
        : `Effectif actif insuffisant (${N} étudiants) pour attribuer ${targetK} partenaires d'autres anciennes classes à chacun.`;
    blockingReasons.push(msg);
    warnings.push({
      code: "SMALL_COHORT_SIZE",
      severity: "CRITICAL",
      message: msg,
    });
  }

  if ((N * targetK) % 2 === 1 && N > 0) {
    const msg = `La somme totale des places (${N} étudiants × ${targetK} = ${N * targetK}) est impaire : dans un graphe non orienté, au moins une place restera mathématiquement non pourvue.`;
    blockingReasons.push(msg);
    warnings.push({
      code: "ODD_STUDENT_COUNT_PARITY",
      severity: "WARNING",
      message: msg,
    });
  }

  if (largestGroupSize > N - largestGroupSize && groups.length >= 2) {
    const dominant = groups.find((g) => g.members.length === largestGroupSize)!;
    const msg = `L'ancienne classe « ${dominant.name} » est majoritaire face à l'ensemble des autres anciennes classes réunies : toutes les places entre anciennes classes ne peuvent pas être comblées.`;
    blockingReasons.push(msg);
    warnings.push({
      code: "SINGLE_GROUP_DOMINANCE",
      severity: "WARNING",
      message: msg,
    });
  }

  const mathematicalLimitsExplanation =
    `Chaque étudiant reçoit jusqu'à ${targetK} partenaires entre anciennes classes par semaine. ` +
    `Les paires déjà validées par l'administrateur sont verrouillées (${preservedApprovedPairs.length} paire(s) validée(s)) et seules les places vacantes restantes sont recherchées en excluant les paires refusées sur le cycle.`;

  // Fast idempotent return when all slots are already covered by APPROVED pairs
  if (totalRemainingStudentSlots === 0 && N >= 4 && groups.length >= 2) {
    const allActive: GeneratedPair[] = preservedApprovedPairs.map((p) => {
      const [, , key] = makeCanonicalPairKey(p.studentAId, p.studentBId);
      const prev = historyByPair.get(key) ?? [];
      return {
        studentAId: p.studentAId,
        studentBId: p.studentBId,
        isRepeat: prev.length > 0,
        previousWeeks: [...prev].sort((a, b) => a - b),
      };
    });
    const validation = validateMatchingResult(allActive, validStudents, targetK);
    const stats: MatchingGenerationStats = {
      algorithmVersion: ALGORITHM_VERSION,
      seed,
      weekNumber,
      totalWeeksInCycle: totalWeeks,
      targetPartnersPerWeek: targetK,
      totalActiveStudents: N,
      totalGroups: groups.length,
      totalPairsGenerated: allActive.length,
      theoreticalMaxPairsThisWeek,
      repeatPairsCount: allActive.filter((p) => p.isRepeat).length,
      studentsWithFullTarget: N,
      studentsWithPartialTarget: 0,
      studentsWithZeroPartners: 0,
      degreeDistribution: { [targetK]: N },
      interGroupMatrix: {},
      mathematicalLimitsExplanation,
      groupCoverageMetrics,
      warnings,
      executionTimeMs: Date.now() - startTime,
    };
    return {
      preservedApprovedPairs,
      newPendingPairs: [],
      allActivePairs: allActive,
      remainingSlotsByStudent,
      totalRequiredPairs,
      approvedPairsCount: preservedApprovedPairs.length,
      newPendingPairsCount: 0,
      missingSlotsCount: 0,
      complete: validation.valid && blockingReasons.length === 0,
      valid: validation.valid,
      validationErrors: validation.errors,
      blockingReasons,
      stats,
    };
  }

  // 4. Build legal residual candidate edges (strictly inter-group, non-approved, non-excluded, non-repeat)
  interface ResidualEdge {
    uIdx: number;
    vIdx: number;
    uId: string;
    vId: string;
    key: string;
    repeatCount: number;
    previousWeeks: number[];
    isPreferredPending: boolean;
  }

  const candidateEdges: ResidualEdge[] = [];
  const adjCandidates: number[][] = Array.from({ length: N }, () => []);
  const pairToEdgeIdx = new Map<string, number>();

  for (let i = 0; i < N; i++) {
    if (residualNeed[i] <= 0) continue;
    for (let j = i + 1; j < N; j++) {
      if (residualNeed[j] <= 0) continue;
      const sA = validStudents[i];
      const sB = validStudents[j];
      if (sA.groupId === sB.groupId) continue;

      const [, , key] = makeCanonicalPairKey(sA.id, sB.id);
      if (approvedKeySet.has(key)) continue;
      if (excludedKeySet.has(key)) continue;

      const prevWeeks = historyByPair.get(key) ?? [];
      if (forbidHistoricalRepeats && prevWeeks.length > 0) continue;

      const eIdx = candidateEdges.length;
      candidateEdges.push({
        uIdx: i,
        vIdx: j,
        uId: sA.id,
        vId: sB.id,
        key,
        repeatCount: prevWeeks.length,
        previousWeeks: prevWeeks,
        isPreferredPending: preferredPendingKeySet.has(key),
      });
      adjCandidates[i].push(eIdx);
      adjCandidates[j].push(eIdx);
      pairToEdgeIdx.set(`${i}:${j}`, eIdx);
      pairToEdgeIdx.set(`${j}:${i}`, eIdx);
    }
  }

  // Check if any student with residualNeed > 0 already has fewer legal candidate partners than needed!
  const constrainedStudentNames: string[] = [];
  for (let i = 0; i < N; i++) {
    if (residualNeed[i] > 0 && adjCandidates[i].length < residualNeed[i]) {
      constrainedStudentNames.push(
        `${validStudents[i].firstName} ${validStudents[i].lastName} (${adjCandidates[i].length}/${residualNeed[i]} partenaire(s) compatible(s))`
      );
    }
  }
  if (constrainedStudentNames.length > 0) {
    blockingReasons.push(
      `Certains étudiants n'ont pas assez de partenaires d'autres anciennes classes compatibles non exclus : ${constrainedStudentNames.slice(0, 4).join(", ")}${constrainedStudentNames.length > 4 ? "…" : ""}.`
    );
  }

  // 5. Solve residual b-matching with multi-restart MRV + bidirectional augmenting swaps
  const rng = createSeededRng(seed);
  const targetResidualEdges = Math.floor(totalRemainingStudentSlots / 2);

  let bestSelectedEdges: ResidualEdge[] = [];
  let bestScore = -Infinity;

  if (N >= 2 && groups.length >= 2 && candidateEdges.length > 0) {
    for (let attempt = 0; attempt < restarts; attempt++) {
      const addedDeg = new Int32Array(N);
      const selectedSet = new Set<number>();
      const weekGroupSeen = lockedGroupSeen.map((m) => new Map(m));

      const baseOrder = seededShuffle(
        Array.from({ length: N }, (_, idx) => idx).filter(
          (idx) => residualNeed[idx] > 0
        ),
        rng
      );

      let progress = true;
      while (progress) {
        progress = false;

        // MRV ordering: fewest available legal partners relative to remaining deficit first
        const needy = baseOrder
          .filter((idx) => addedDeg[idx] < residualNeed[idx])
          .sort((i, j) => {
            const remI = residualNeed[i] - addedDeg[i];
            const remJ = residualNeed[j] - addedDeg[j];
            const availI = adjCandidates[i].reduce((acc, eIdx) => {
              if (selectedSet.has(eIdx)) return acc;
              const e = candidateEdges[eIdx];
              const other = e.uIdx === i ? e.vIdx : e.uIdx;
              return addedDeg[other] < residualNeed[other] ? acc + 1 : acc;
            }, 0);
            const availJ = adjCandidates[j].reduce((acc, eIdx) => {
              if (selectedSet.has(eIdx)) return acc;
              const e = candidateEdges[eIdx];
              const other = e.uIdx === j ? e.vIdx : e.uIdx;
              return addedDeg[other] < residualNeed[other] ? acc + 1 : acc;
            }, 0);
            const slackI = availI - remI;
            const slackJ = availJ - remJ;
            if (slackI !== slackJ) return slackI - slackJ;
            if (remJ !== remI) return remJ - remI;
            const gSizeI = groupMap.get(validStudents[i].groupId)!.members.length;
            const gSizeJ = groupMap.get(validStudents[j].groupId)!.members.length;
            return gSizeJ - gSizeI;
          });

        if (needy.length === 0) break;

        for (const u of needy) {
          if (addedDeg[u] >= residualNeed[u]) continue;
          const sU = validStudents[u];
          const histGroupU = historicalGroupCountByStudent.get(sU.id)!;
          const weekGroupU = weekGroupSeen[u];

          let chosenEdgeIdx = -1;
          let bestEval = -Infinity;

          const incidence = seededShuffle(adjCandidates[u], rng);
          for (const eIdx of incidence) {
            if (selectedSet.has(eIdx)) continue;
            const edge = candidateEdges[eIdx];
            const v = edge.uIdx === u ? edge.vIdx : edge.uIdx;
            if (addedDeg[v] >= residualNeed[v]) continue;

            const sV = validStudents[v];
            const histGroupV = historicalGroupCountByStudent.get(sV.id)!;
            const weekGroupV = weekGroupSeen[v];

            let evalScore = 0;
            // Gently prefer already-proposed unrejected pending pairs on early attempts for stability,
            // while exploring fresh permutations on subsequent attempts if needed!
            if (edge.isPreferredPending && attempt < 6) {
              evalScore += 220;
            }
            evalScore += (residualNeed[v] - addedDeg[v]) * 130;

            const seenWeek =
              (weekGroupU.get(sV.groupId) ?? 0) +
              (weekGroupV.get(sU.groupId) ?? 0);
            evalScore -= seenWeek * 45;

            const seenHist =
              (histGroupU.get(sV.groupId) ?? 0) +
              (histGroupV.get(sU.groupId) ?? 0);
            evalScore -= seenHist * 18;

            const vGroupSize = groupMap.get(sV.groupId)!.members.length;
            evalScore += vGroupSize * 3;

            if (evalScore > bestEval) {
              bestEval = evalScore;
              chosenEdgeIdx = eIdx;
            }
          }

          if (chosenEdgeIdx !== -1) {
            selectedSet.add(chosenEdgeIdx);
            const chosen = candidateEdges[chosenEdgeIdx];
            addedDeg[chosen.uIdx]++;
            addedDeg[chosen.vIdx]++;
            const gU = validStudents[chosen.uIdx].groupId;
            const gV = validStudents[chosen.vIdx].groupId;
            weekGroupSeen[chosen.uIdx].set(
              gV,
              (weekGroupSeen[chosen.uIdx].get(gV) ?? 0) + 1
            );
            weekGroupSeen[chosen.vIdx].set(
              gU,
              (weekGroupSeen[chosen.vIdx].get(gU) ?? 0) + 1
            );
            progress = true;
          }
        }
      }

      // Augmenting 2-edge swap repair ONLY on newly proposed PENDING edges (never touches APPROVED pairs!)
      let augmented = true;
      let swapGuard = 0;
      while (augmented && swapGuard < 80) {
        augmented = false;
        swapGuard++;

        const deficient = baseOrder.filter(
          (idx) => addedDeg[idx] < residualNeed[idx]
        );
        if (deficient.length === 0) break;

        // Case A: Single vertex u missing >= 2 slots -> replace (x, y) with (u, x) and (u, y)
        outerSingle: for (const u of deficient) {
          if (residualNeed[u] - addedDeg[u] < 2) continue;
          for (const exIdx of Array.from(selectedSet)) {
            const ex = candidateEdges[exIdx];
            const x = ex.uIdx;
            const y = ex.vIdx;
            if (x === u || y === u) continue;
            const ux = pairToEdgeIdx.get(`${u}:${x}`);
            const uy = pairToEdgeIdx.get(`${u}:${y}`);
            if (
              ux !== undefined &&
              uy !== undefined &&
              !selectedSet.has(ux) &&
              !selectedSet.has(uy)
            ) {
              selectedSet.delete(exIdx);
              selectedSet.add(ux);
              selectedSet.add(uy);
              addedDeg[u] += 2;
              augmented = true;
              break outerSingle;
            }
          }
        }
        if (augmented) continue;

        // Case B: Two distinct deficient vertices u, v -> replace (x, y) with (u, x)+(v, y) or (u, y)+(v, x)
        outerPair: for (let i = 0; i < deficient.length; i++) {
          for (let j = i + 1; j < deficient.length; j++) {
            const u = deficient[i];
            const v = deficient[j];
            if (addedDeg[u] >= residualNeed[u] || addedDeg[v] >= residualNeed[v]) {
              continue;
            }

            // Direct edge check first just in case
            const direct = pairToEdgeIdx.get(`${u}:${v}`);
            if (direct !== undefined && !selectedSet.has(direct)) {
              selectedSet.add(direct);
              addedDeg[u]++;
              addedDeg[v]++;
              augmented = true;
              break outerPair;
            }

            for (const exIdx of Array.from(selectedSet)) {
              const ex = candidateEdges[exIdx];
              const x = ex.uIdx;
              const y = ex.vIdx;
              if (x === u || x === v || y === u || y === v) continue;

              // Orientation 1: (u, x) and (v, y)
              const ux = pairToEdgeIdx.get(`${u}:${x}`);
              const vy = pairToEdgeIdx.get(`${v}:${y}`);
              if (
                ux !== undefined &&
                vy !== undefined &&
                ux !== vy &&
                !selectedSet.has(ux) &&
                !selectedSet.has(vy)
              ) {
                selectedSet.delete(exIdx);
                selectedSet.add(ux);
                selectedSet.add(vy);
                addedDeg[u]++;
                addedDeg[v]++;
                augmented = true;
                break outerPair;
              }

              // Orientation 2: (u, y) and (v, x)
              const uy = pairToEdgeIdx.get(`${u}:${y}`);
              const vx = pairToEdgeIdx.get(`${v}:${x}`);
              if (
                uy !== undefined &&
                vx !== undefined &&
                uy !== vx &&
                !selectedSet.has(uy) &&
                !selectedSet.has(vx)
              ) {
                selectedSet.delete(exIdx);
                selectedSet.add(uy);
                selectedSet.add(vx);
                addedDeg[u]++;
                addedDeg[v]++;
                augmented = true;
                break outerPair;
              }
            }
          }
        }
      }

      const currentEdges = Array.from(selectedSet).map(
        (idx) => candidateEdges[idx]
      );
      let missingAfter = 0;
      let preferredKept = 0;
      let diversity = 0;

      for (let i = 0; i < N; i++) {
        missingAfter += Math.max(0, residualNeed[i] - addedDeg[i]);
        diversity += weekGroupSeen[i].size;
      }
      for (const e of currentEdges) {
        if (e.isPreferredPending) preferredKept++;
      }

      const totalScore =
        currentEdges.length * 10000 -
        missingAfter * 8000 +
        preferredKept * 40 +
        diversity * 15;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSelectedEdges = currentEdges;
        if (currentEdges.length === targetResidualEdges && missingAfter === 0) {
          break;
        }
      }
    }
  }

  // 6. Assemble newPendingPairs + allActivePairs and compute diagnostics
  const newPendingPairs: GeneratedPair[] = bestSelectedEdges
    .map((e) => {
      const [studentAId, studentBId] = makeCanonicalPairKey(e.uId, e.vId);
      return {
        studentAId,
        studentBId,
        isRepeat: e.repeatCount > 0,
        previousWeeks: [...e.previousWeeks].sort((a, b) => a - b),
      };
    })
    .sort((a, b) =>
      a.studentAId !== b.studentAId
        ? a.studentAId.localeCompare(b.studentAId)
        : a.studentBId.localeCompare(b.studentBId)
    );

  const approvedGeneratedPairs: GeneratedPair[] = preservedApprovedPairs.map(
    (p) => {
      const [, , key] = makeCanonicalPairKey(p.studentAId, p.studentBId);
      const prev = historyByPair.get(key) ?? [];
      return {
        studentAId: p.studentAId,
        studentBId: p.studentBId,
        isRepeat: prev.length > 0,
        previousWeeks: [...prev].sort((a, b) => a - b),
      };
    }
  );

  const allActivePairs: GeneratedPair[] = [
    ...approvedGeneratedPairs,
    ...newPendingPairs,
  ].sort((a, b) =>
    a.studentAId !== b.studentAId
      ? a.studentAId.localeCompare(b.studentAId)
      : a.studentBId.localeCompare(b.studentBId)
  );

  const finalDegrees = new Map<string, number>();
  for (const s of validStudents) finalDegrees.set(s.id, 0);

  const interGroupMatrix: Record<string, Record<string, number>> = {};
  for (const g1 of groups) {
    interGroupMatrix[g1.name] = {};
    for (const g2 of groups) interGroupMatrix[g1.name][g2.name] = 0;
  }

  for (const p of allActivePairs) {
    if (finalDegrees.has(p.studentAId)) {
      finalDegrees.set(p.studentAId, (finalDegrees.get(p.studentAId) ?? 0) + 1);
    }
    if (finalDegrees.has(p.studentBId)) {
      finalDegrees.set(p.studentBId, (finalDegrees.get(p.studentBId) ?? 0) + 1);
    }
    const sA = studentById.get(p.studentAId);
    const sB = studentById.get(p.studentBId);
    if (sA && sB) {
      interGroupMatrix[sA.groupName][sB.groupName] =
        (interGroupMatrix[sA.groupName][sB.groupName] ?? 0) + 1;
      interGroupMatrix[sB.groupName][sA.groupName] =
        (interGroupMatrix[sB.groupName][sA.groupName] ?? 0) + 1;
    }
  }

  let missingSlotsCount = 0;
  let studentsWithFullTarget = 0;
  let studentsWithPartialTarget = 0;
  let studentsWithZeroPartners = 0;
  const degreeDistribution: Record<number, number> = {};
  const unfilledStudents: string[] = [];

  for (const s of validStudents) {
    const deg = finalDegrees.get(s.id) ?? 0;
    degreeDistribution[deg] = (degreeDistribution[deg] ?? 0) + 1;
    if (deg >= targetK) {
      studentsWithFullTarget++;
    } else {
      const diff = targetK - deg;
      missingSlotsCount += diff;
      unfilledStudents.push(`${s.firstName} ${s.lastName} (${deg}/${targetK})`);
      if (deg > 0) studentsWithPartialTarget++;
      else studentsWithZeroPartners++;
    }
  }

  if (missingSlotsCount > 0 && blockingReasons.length === 0) {
    const lockedHint =
      preservedApprovedPairs.length > 0
        ? " Certaines paires déjà verrouillées comme validées bloquent les dernières permutations possibles (remettez une paire validée en attente si vous souhaitez débloquer un échange)."
        : "";
    blockingReasons.push(
      `${missingSlotsCount} place(s) de jumelage restent non pourvues (${unfilledStudents.slice(0, 4).join(", ")}${unfilledStudents.length > 4 ? "…" : ""}) compte tenu des contraintes entre anciennes classes, de l'historique du cycle et des ${excludedKeySet.size} exclusion(s) enregistrée(s).${lockedHint}`
    );
  }

  const validation = validateMatchingResult(
    allActivePairs,
    validStudents,
    targetK
  );

  const complete =
    validation.valid &&
    N >= 4 &&
    groups.length >= 2 &&
    missingSlotsCount === 0 &&
    unassignedCount === 0;

  const stats: MatchingGenerationStats = {
    algorithmVersion: ALGORITHM_VERSION,
    seed,
    weekNumber,
    totalWeeksInCycle: totalWeeks,
    targetPartnersPerWeek: targetK,
    totalActiveStudents: N,
    totalGroups: groups.length,
    totalPairsGenerated: allActivePairs.length,
    theoreticalMaxPairsThisWeek,
    repeatPairsCount: allActivePairs.filter((p) => p.isRepeat).length,
    studentsWithFullTarget,
    studentsWithPartialTarget,
    studentsWithZeroPartners,
    degreeDistribution,
    interGroupMatrix,
    mathematicalLimitsExplanation,
    groupCoverageMetrics,
    warnings,
    executionTimeMs: Date.now() - startTime,
  };

  return {
    preservedApprovedPairs,
    newPendingPairs,
    allActivePairs,
    remainingSlotsByStudent,
    totalRequiredPairs,
    approvedPairsCount: preservedApprovedPairs.length,
    newPendingPairsCount: newPendingPairs.length,
    missingSlotsCount,
    complete,
    valid: validation.valid,
    validationErrors: validation.errors,
    blockingReasons,
    stats,
  };
}

/**
 * Strictly verifies ALL server-side preconditions required before a week can be
 * officially published to students (Partie 5.2).
 */
export function evaluateWeekPublicationReadiness(
  input: PublicationReadinessInput
): PublicationReadinessReport {
  const targetK = input.targetPartnersPerWeek ?? 3;
  const forbidHistoricalRepeats = input.forbidHistoricalRepeats ?? true;
  const reasons: string[] = [];

  const unassignedStudents = input.students.filter(
    (s) => !s.groupId || !s.groupId.trim()
  );
  if (unassignedStudents.length > 0) {
    reasons.push(
      `${unassignedStudents.length} étudiant(s) actif(s) n'ont pas encore d'ancienne classe attribuée.`
    );
  }

  const validStudents = input.students.filter((s) =>
    Boolean(s.groupId && s.groupId.trim())
  );
  const N = validStudents.length;
  const groupIds = new Set(validStudents.map((s) => s.groupId));
  const requiredPairsCount = Math.floor((N * targetK) / 2);

  if (N < 4 || groupIds.size < 2) {
    reasons.push(
      "L'effectif actif ou le nombre d'anciennes classes est insuffisant pour publier une semaine complète."
    );
  }

  if ((N * targetK) % 2 !== 0) {
    reasons.push(
      `Le nombre total de places requises (${N} × ${targetK} = ${N * targetK}) est impair : publication complète impossible sans ajuster la cohorte.`
    );
  }

  if (input.pendingPairs.length > 0) {
    reasons.push(
      `${input.pendingPairs.length} paire(s) proposée(s) sont encore en attente de validation administrative.`
    );
  }

  const studentById = new Map<string, MatchingStudent>(
    validStudents.map((s) => [s.id, s])
  );

  const excludedKeySet = new Set<string>();
  for (const ex of input.excludedPairs) {
    if (ex.studentAId && ex.studentBId && ex.studentAId !== ex.studentBId) {
      const [, , key] = makeCanonicalPairKey(ex.studentAId, ex.studentBId);
      excludedKeySet.add(key);
    }
  }

  const historicalKeySet = new Set<string>();
  for (const hp of input.historicalPairs) {
    if (hp.studentAId && hp.studentBId && hp.studentAId !== hp.studentBId) {
      const [, , key] = makeCanonicalPairKey(hp.studentAId, hp.studentBId);
      historicalKeySet.add(key);
    }
  }

  const seenApprovedKeys = new Set<string>();
  const approvedDegrees = new Map<string, number>();
  for (const s of validStudents) {
    approvedDegrees.set(s.id, 0);
  }

  let intraGroupCount = 0;
  let excludedReintroducedCount = 0;
  let repeatCount = 0;
  let duplicateCount = 0;
  let unknownStudentCount = 0;

  for (const pair of input.approvedPairs) {
    if (pair.studentAId === pair.studentBId) {
      reasons.push("Une paire invalide contient deux fois le même étudiant.");
      continue;
    }

    const [a, b, key] = makeCanonicalPairKey(pair.studentAId, pair.studentBId);
    if (seenApprovedKeys.has(key)) {
      duplicateCount++;
      continue;
    }
    seenApprovedKeys.add(key);

    if (excludedKeySet.has(key)) {
      excludedReintroducedCount++;
    }
    if (forbidHistoricalRepeats && historicalKeySet.has(key)) {
      repeatCount++;
    }

    const sA = studentById.get(a);
    const sB = studentById.get(b);
    if (!sA || !sB) {
      unknownStudentCount++;
      continue;
    }

    if (sA.groupId === sB.groupId) {
      intraGroupCount++;
    }

    approvedDegrees.set(a, (approvedDegrees.get(a) ?? 0) + 1);
    approvedDegrees.set(b, (approvedDegrees.get(b) ?? 0) + 1);
  }

  if (duplicateCount > 0) {
    reasons.push(`${duplicateCount} paire(s) en doublon détectée(s).`);
  }
  if (unknownStudentCount > 0) {
    reasons.push(
      `${unknownStudentCount} paire(s) validée(s) concernent un compte inactif ou sans ancienne classe.`
    );
  }
  if (intraGroupCount > 0) {
    reasons.push(
      `${intraGroupCount} paire(s) au sein de la même ancienne classe détectée(s) (interdit).`
    );
  }
  if (excludedReintroducedCount > 0) {
    reasons.push(
      `${excludedReintroducedCount} paire(s) précédemment refusée(s) sur ce cycle figurent parmi les paires validées.`
    );
  }
  if (repeatCount > 0) {
    reasons.push(
      `${repeatCount} répétition(s) interdite(s) avec une semaine antérieure du même cycle.`
    );
  }

  let remainingStudentSlots = 0;
  let overAssignedCount = 0;
  let underAssignedCount = 0;

  for (const s of validStudents) {
    const deg = approvedDegrees.get(s.id) ?? 0;
    if (deg > targetK) {
      overAssignedCount++;
    } else if (deg < targetK) {
      underAssignedCount++;
      remainingStudentSlots += targetK - deg;
    }
  }

  if (overAssignedCount > 0) {
    reasons.push(
      `${overAssignedCount} étudiant(s) dépassent le plafond de ${targetK} partenaires.`
    );
  }
  if (underAssignedCount > 0 || remainingStudentSlots > 0) {
    reasons.push(
      `${remainingStudentSlots} place(s) de jumelage restent à pourvoir et valider (${underAssignedCount} étudiant(s) incomplets).`
    );
  }
  if (seenApprovedKeys.size === 0) {
    reasons.push("Aucune paire n'a encore été générée et validée.");
  }

  return {
    ready: reasons.length === 0 && N >= 4 && groupIds.size >= 2,
    reasons,
    approvedCount: seenApprovedKeys.size,
    pendingCount: input.pendingPairs.length,
    rejectedCount: input.rejectedPairsCount,
    remainingStudentSlots,
    requiredPairsCount,
  };
}
