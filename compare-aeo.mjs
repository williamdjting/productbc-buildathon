#!/usr/bin/env node

// Compares two AEO evaluation JSON files and shows improvements, regressions, and changes

import fs from "node:fs/promises";

const STATUS_ORDER = { "yes": 3, "partial": 2, "no": 1, "not_evaluated": 0 };

function getStatusValue(status) {
  return STATUS_ORDER[status] || -1;
}

function isImprovement(oldStatus, newStatus) {
  const oldVal = getStatusValue(oldStatus);
  const newVal = getStatusValue(newStatus);
  return newVal > oldVal;
}

function isRegression(oldStatus, newStatus) {
  const oldVal = getStatusValue(oldStatus);
  const newVal = getStatusValue(newStatus);
  return newVal < oldVal;
}

function flattenEvaluation(eval_, prefix = "") {
  const results = [];
  
  if (!eval_ || typeof eval_ !== "object") return results;
  
  // If this object has a status field, it's a criterion
  if (eval_.status) {
    results.push({
      key: prefix,
      status: eval_.status,
      reason: eval_.reason || "",
      evidence: eval_.evidence || []
    });
  }
  
  // Recursively process nested objects
  for (const [k, v] of Object.entries(eval_)) {
    if (k === "status" || k === "reason" || k === "evidence") continue;
    if (typeof v === "object" && v !== null) {
      const newPrefix = prefix ? `${prefix}.${k}` : k;
      results.push(...flattenEvaluation(v, newPrefix));
    }
  }
  
  return results;
}

function formatStatus(status) {
  const emoji = {
    "yes": "✅",
    "partial": "⚠️",
    "no": "❌",
    "not_evaluated": "⚪"
  };
  return `${emoji[status] || ""} ${status}`;
}

function formatChange(oldStatus, newStatus) {
  if (oldStatus === newStatus) return "→";
  if (isImprovement(oldStatus, newStatus)) return "📈";
  if (isRegression(oldStatus, newStatus)) return "📉";
  return "↔️";
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("-o");
  const hasOut = outIdx !== -1;
  const outPath = hasOut ? args[outIdx + 1] : null;
  const rest = hasOut ? args.slice(0, outIdx).concat(args.slice(outIdx + 2)) : args;
  const [oldPath, newPath] = rest;

  if (!oldPath || !newPath) {
    console.error("Usage: node compare-aeo.mjs <old-aeo-report.json> <new-aeo-report.json> [-o <output-path>]");
    process.exit(1);
  }

  const lines = [];
  const out = (...msgs) => lines.push(msgs.join(""));
  
  let oldReport, newReport;
  try {
    const [oldRaw, newRaw] = await Promise.all([
      fs.readFile(oldPath, "utf8"),
      fs.readFile(newPath, "utf8")
    ]);
    oldReport = JSON.parse(oldRaw);
    newReport = JSON.parse(newRaw);
  } catch (err) {
    console.error("ERROR reading files:", err.message);
    process.exit(1);
  }
  
  const oldEval = oldReport?.aeo_checklist_evaluation;
  const newEval = newReport?.aeo_checklist_evaluation;
  
  if (!oldEval || !newEval) {
    console.error("ERROR: Both files must contain aeo_checklist_evaluation.");
    process.exit(1);
  }
  
  const oldFlat = flattenEvaluation(oldEval);
  const newFlat = flattenEvaluation(newEval);
  
  // Create maps for easy lookup
  const oldMap = new Map(oldFlat.map(item => [item.key, item]));
  const newMap = new Map(newFlat.map(item => [item.key, item]));
  
  // Get all unique keys
  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const sortedKeys = Array.from(allKeys).sort();
  
  // Categorize changes
  const improvements = [];
  const regressions = [];
  const unchanged = [];
  const added = [];
  const removed = [];
  
  for (const key of sortedKeys) {
    const oldItem = oldMap.get(key);
    const newItem = newMap.get(key);
    
    if (!oldItem && newItem) {
      added.push({ key, item: newItem });
    } else if (oldItem && !newItem) {
      removed.push({ key, item: oldItem });
    } else if (oldItem && newItem) {
      if (oldItem.status === newItem.status) {
        unchanged.push({ key, oldItem, newItem });
      } else if (isImprovement(oldItem.status, newItem.status)) {
        improvements.push({ key, oldItem, newItem });
      } else if (isRegression(oldItem.status, newItem.status)) {
        regressions.push({ key, oldItem, newItem });
      } else {
        unchanged.push({ key, oldItem, newItem }); // Status changed but not clearly better/worse
      }
    }
  }
  
  // Print comparison report
  out("=".repeat(80));
  out("AEO EVALUATION COMPARISON");
  out("=".repeat(80));
  out(`Original: ${oldPath}`);
  out(`Revised:  ${newPath}`);
  out();

  // Article metadata comparison
  const oldArticle = oldReport?.article || {};
  const newArticle = newReport?.article || {};
  out("ARTICLE METADATA:");
  out("-".repeat(80));
  for (const key of ["title", "date", "author", "tags"]) {
    const oldVal = oldArticle[key];
    const newVal = newArticle[key];
    if (oldVal !== newVal) {
      out(`  ${key}:`);
      out(`    Old: ${JSON.stringify(oldVal)}`);
      out(`    New: ${JSON.stringify(newVal)}`);
    }
  }
  out();

  // Summary statistics
  out("SUMMARY:");
  out("-".repeat(80));
  out(`  Improvements:  ${improvements.length}`);
  out(`  Regressions:   ${regressions.length}`);
  out(`  Unchanged:     ${unchanged.length}`);
  if (added.length > 0) out(`  Added:         ${added.length}`);
  if (removed.length > 0) out(`  Removed:       ${removed.length}`);
  out();

  // Detailed improvements
  if (improvements.length > 0) {
    out("📈 IMPROVEMENTS:");
    out("-".repeat(80));
    for (const { key, oldItem, newItem } of improvements) {
      out(`  ${key}`);
      out(`    ${formatChange(oldItem.status, newItem.status)} ${formatStatus(oldItem.status)} → ${formatStatus(newItem.status)}`);
      if (newItem.reason && newItem.reason !== oldItem.reason) {
        out(`    New reason: ${newItem.reason}`);
      }
      out();
    }
  }

  // Regressions
  if (regressions.length > 0) {
    out("📉 REGRESSIONS:");
    out("-".repeat(80));
    for (const { key, oldItem, newItem } of regressions) {
      out(`  ${key}`);
      out(`    ${formatChange(oldItem.status, newItem.status)} ${formatStatus(oldItem.status)} → ${formatStatus(newItem.status)}`);
      if (newItem.reason && newItem.reason !== oldItem.reason) {
        out(`    New reason: ${newItem.reason}`);
      }
      out();
    }
  }

  // Unchanged (optional - can be verbose)
  if (unchanged.length > 0 && unchanged.length < 20) {
    out("→ UNCHANGED:");
    out("-".repeat(80));
    for (const { key, oldItem, newItem } of unchanged) {
      out(`  ${key}: ${formatStatus(oldItem.status)}`);
    }
    out();
  }

  // Overall score calculation
  const calculateScore = (items) => {
    let total = 0;
    let count = 0;
    for (const item of items) {
      const val = getStatusValue(item.status);
      if (val >= 0) {
        total += val;
        count++;
      }
    }
    return count > 0 ? (total / count).toFixed(2) : "0.00";
  };

  const oldScore = calculateScore(oldFlat);
  const newScore = calculateScore(newFlat);
  const scoreChange = (parseFloat(newScore) - parseFloat(oldScore)).toFixed(2);

  out("OVERALL SCORE:");
  out("-".repeat(80));
  out(`  Original: ${oldScore} / 3.00`);
  out(`  Revised:  ${newScore} / 3.00`);
  out(`  Change:   ${scoreChange >= 0 ? "+" : ""}${scoreChange}`);
  out();

  // Final verdict
  if (improvements.length > 0 && regressions.length === 0) {
    out("✅ Overall: The revision shows improvements with no regressions!");
  } else if (improvements.length > regressions.length) {
    out("✅ Overall: The revision shows net improvements.");
  } else if (regressions.length > improvements.length) {
    out("⚠️  Overall: The revision shows net regressions.");
  } else if (improvements.length === 0 && regressions.length === 0) {
    out("→ Overall: No changes in evaluation status.");
  } else {
    out("↔️  Overall: Mixed results with both improvements and regressions.");
  }

  const output = lines.join("\n");
  if (outPath) {
    await fs.writeFile(outPath, output, "utf8");
    console.error(`Wrote comparison to ${outPath}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});