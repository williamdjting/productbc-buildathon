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
  const [oldPath, newPath] = args;
  
  if (!oldPath || !newPath) {
    console.error("Usage: node compare-aeo.mjs <old-aeo-report.json> <new-aeo-report.json>");
    process.exit(1);
  }
  
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
  console.log("=".repeat(80));
  console.log("AEO EVALUATION COMPARISON");
  console.log("=".repeat(80));
  console.log(`Original: ${oldPath}`);
  console.log(`Revised:  ${newPath}`);
  console.log();
  
  // Article metadata comparison
  const oldArticle = oldReport?.article || {};
  const newArticle = newReport?.article || {};
  console.log("ARTICLE METADATA:");
  console.log("-".repeat(80));
  for (const key of ["title", "date", "author", "tags"]) {
    const oldVal = oldArticle[key];
    const newVal = newArticle[key];
    if (oldVal !== newVal) {
      console.log(`  ${key}:`);
      console.log(`    Old: ${JSON.stringify(oldVal)}`);
      console.log(`    New: ${JSON.stringify(newVal)}`);
    }
  }
  console.log();
  
  // Summary statistics
  console.log("SUMMARY:");
  console.log("-".repeat(80));
  console.log(`  Improvements:  ${improvements.length}`);
  console.log(`  Regressions:   ${regressions.length}`);
  console.log(`  Unchanged:     ${unchanged.length}`);
  if (added.length > 0) console.log(`  Added:         ${added.length}`);
  if (removed.length > 0) console.log(`  Removed:       ${removed.length}`);
  console.log();
  
  // Detailed improvements
  if (improvements.length > 0) {
    console.log("📈 IMPROVEMENTS:");
    console.log("-".repeat(80));
    for (const { key, oldItem, newItem } of improvements) {
      console.log(`  ${key}`);
      console.log(`    ${formatChange(oldItem.status, newItem.status)} ${formatStatus(oldItem.status)} → ${formatStatus(newItem.status)}`);
      if (newItem.reason && newItem.reason !== oldItem.reason) {
        console.log(`    New reason: ${newItem.reason}`);
      }
      console.log();
    }
  }
  
  // Regressions
  if (regressions.length > 0) {
    console.log("📉 REGRESSIONS:");
    console.log("-".repeat(80));
    for (const { key, oldItem, newItem } of regressions) {
      console.log(`  ${key}`);
      console.log(`    ${formatChange(oldItem.status, newItem.status)} ${formatStatus(oldItem.status)} → ${formatStatus(newItem.status)}`);
      if (newItem.reason && newItem.reason !== oldItem.reason) {
        console.log(`    New reason: ${newItem.reason}`);
      }
      console.log();
    }
  }
  
  // Unchanged (optional - can be verbose)
  if (unchanged.length > 0 && unchanged.length < 20) {
    console.log("→ UNCHANGED:");
    console.log("-".repeat(80));
    for (const { key, oldItem, newItem } of unchanged) {
      console.log(`  ${key}: ${formatStatus(oldItem.status)}`);
    }
    console.log();
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
  
  console.log("OVERALL SCORE:");
  console.log("-".repeat(80));
  console.log(`  Original: ${oldScore} / 3.00`);
  console.log(`  Revised:  ${newScore} / 3.00`);
  console.log(`  Change:   ${scoreChange >= 0 ? "+" : ""}${scoreChange}`);
  console.log();
  
  // Final verdict
  if (improvements.length > 0 && regressions.length === 0) {
    console.log("✅ Overall: The revision shows improvements with no regressions!");
  } else if (improvements.length > regressions.length) {
    console.log("✅ Overall: The revision shows net improvements.");
  } else if (regressions.length > improvements.length) {
    console.log("⚠️  Overall: The revision shows net regressions.");
  } else if (improvements.length === 0 && regressions.length === 0) {
    console.log("→ Overall: No changes in evaluation status.");
  } else {
    console.log("↔️  Overall: Mixed results with both improvements and regressions.");
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});