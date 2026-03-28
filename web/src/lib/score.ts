import type { Criterion, CriterionResult } from "./types";

// How much each status is worth as a fraction of the criterion's weight.
// "na" is null — these criteria are excluded from the average entirely.
const STATUS_MULTIPLIER: Record<string, number | null> = {
  pass: 1,
  warn: 0.7,
  fail: 0,
  na: null, // excluded — not counted as 0
};

interface Scores {
  aeoScore: number;
  geoScore: number;
  overallScore: number;
}

/**
 * Calculates AEO score, GEO score, and overall score (all 0–100).
 *
 * Rules:
 * - "na" criteria are excluded from the average (not counted as 0)
 * - pass = full weight, warn = half weight, fail = 0
 * - AEO and GEO are scored separately from their category's criteria
 * - overall = 60% AEO + 40% GEO
 */
export function calcScores(
  results: CriterionResult[],
  criteria: Criterion[]
): Scores {
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

  let aeoWeightedSum = 0;
  let aeoTotalWeight = 0;
  let geoWeightedSum = 0;
  let geoTotalWeight = 0;

  for (const result of results) {
    const multiplier = STATUS_MULTIPLIER[result.status];
    if (multiplier === null) continue; // skip "na"

    const criterion = criteriaMap.get(result.id);
    if (!criterion) continue;

    const contribution = criterion.weight * multiplier;

    if (criterion.category === "aeo") {
      aeoWeightedSum += contribution;
      aeoTotalWeight += criterion.weight;
    } else {
      geoWeightedSum += contribution;
      geoTotalWeight += criterion.weight;
    }
  }

  const aeoScore =
    aeoTotalWeight > 0
      ? Math.round((aeoWeightedSum / aeoTotalWeight) * 100)
      : 0;

  const geoScore =
    geoTotalWeight > 0
      ? Math.round((geoWeightedSum / geoTotalWeight) * 100)
      : 0;

  // AEO is the primary use case so it gets more weight in the overall
  const overallScore = Math.round(aeoScore * 0.6 + geoScore * 0.4);

  return { aeoScore, geoScore, overallScore };
}
