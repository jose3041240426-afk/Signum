interface RFNode {
  f: number;
  t: number;
  l: number;
  r: number;
  v?: number[][];
}

interface RFTree {
  n: RFNode[];
}

interface RFModel {
  nTrees: number;
  nFeatures: number;
  classes: string[];
  trees: RFTree[];
}

interface PredictionResult {
  label: string;
  confidence: number;
}

class RandomForestPredictor {
  private model: RFModel | null = null;

  async load(url: string): Promise<void> {
    const res = await fetch(url);
    this.model = await res.json();
  }

  isLoaded(): boolean {
    return this.model !== null;
  }

  predict(features: number[]): PredictionResult | null {
    if (!this.model || features.length !== this.model.nFeatures) return null;

    const votes: Record<string, number> = {};
    for (const tree of this.model.trees) {
      let idx = 0;
      const nodes = tree.n;
      while (nodes[idx].l !== -1) {
        idx = features[nodes[idx].f] <= nodes[idx].t ? nodes[idx].l : nodes[idx].r;
      }
      const probs = nodes[idx].v![0];
      const maxIdx = probs.indexOf(Math.max(...probs));
      const label = this.model.classes[maxIdx];
      votes[label] = (votes[label] || 0) + 1;
    }

    // Find winner and confidence
    let best = "";
    let bestCount = 0;
    for (const [label, count] of Object.entries(votes)) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }

    return {
      label: best,
      confidence: Math.round((bestCount / this.model.nTrees) * 1000) / 10,
    };
  }
}

export { RandomForestPredictor };
export type { RFModel, PredictionResult };
