// Generates data/weight-profiles.json from the KB's base module_weight
// (data/modules.json), so every profile is traceable back to the KB rather
// than hand-picked numbers. Each profile up-weights a small set of target
// modules by BOOST_FACTOR and renormalizes across all 14 modules.
import * as fs from "fs";
import * as path from "path";
import type { ModuleSummary, WeightProfile, WeightProfileId } from "../lib/types";

const DATA_DIR = path.join(__dirname, "..", "data");
const BOOST_FACTOR = 2.5;

const modules: ModuleSummary[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "modules.json"), "utf-8")
);

const PROFILES: {
  id: WeightProfileId;
  name: string;
  description: string;
  targetModules: string[];
}[] = [
  {
    id: "cost_sensitive",
    name: "Cost-sensitive",
    description:
      "Optimizes for the lowest cost at scale - supplying the network efficiently, maximizing utilization, and sizing fleet/capacity economically.",
    targetModules: ["RM8", "RM6", "RM5"],
  },
  {
    id: "process_sensitive",
    name: "Process-sensitive",
    description:
      "Wants a dependable, controlled, repeatable operation - disciplined planning, a defined cadence, and continuous root-cause improvement.",
    targetModules: ["RM1", "RM2", "RM4", "RM14"],
  },
  {
    id: "quality_sensitive",
    name: "Quality-sensitive",
    description:
      "Prioritizes protecting availability and the customer promise at the store level - shelf outcomes, cold chain, and service reliability.",
    targetModules: ["RM13", "RM9", "RM7"],
  },
  {
    id: "balanced",
    name: "Balanced",
    description:
      "Continuously balances service, cost, capacity, inventory and responsiveness across the whole network - no single lever dominates.",
    targetModules: [],
  },
];

function buildProfile(
  targetModules: string[]
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const m of modules) {
    raw[m.module_id] =
      m.module_weight * (targetModules.includes(m.module_id) ? BOOST_FACTOR : 1);
  }
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  const normalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    normalized[k] = v / total;
  }
  return normalized;
}

const profiles: WeightProfile[] = PROFILES.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  module_weights: buildProfile(p.targetModules),
}));

fs.writeFileSync(
  path.join(DATA_DIR, "weight-profiles.json"),
  JSON.stringify(profiles, null, 2)
);

for (const p of profiles) {
  const sum = Object.values(p.module_weights).reduce((s, v) => s + v, 0);
  console.log(`${p.id}: sum=${sum.toFixed(4)}`);
}
