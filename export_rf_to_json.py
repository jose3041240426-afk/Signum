import pickle
import json
import sys
import os
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE, "frontend", "public", "models")
os.makedirs(PUBLIC_DIR, exist_ok=True)

def export_rf(pkl_path: str, out_path: str, label_encoder_path: str = None):
    with open(pkl_path, "rb") as f:
        model = pickle.load(f)

    classes: list = model.classes_.tolist()
    if label_encoder_path:
        with open(label_encoder_path, "rb") as f:
            le = pickle.load(f)
        classes = le.classes_.tolist()

    trees = []
    for est in model.estimators_:
        t = est.tree_
        nodes = []
        for i in range(t.node_count):
            node = {
                "f": int(t.feature[i]),
                "t": float(t.threshold[i]),
                "l": int(t.children_left[i]),
                "r": int(t.children_right[i]),
            }
            if t.children_left[i] == -1:
                node["v"] = t.value[i].tolist()
            nodes.append(node)
        trees.append({"n": nodes})

    result = {
        "nTrees": model.n_estimators,
        "nFeatures": model.n_features_in_,
        "classes": classes,
        "trees": trees,
    }
    with open(out_path, "w") as f:
        json.dump(result, f)
    size = os.path.getsize(out_path)
    print(f"Exported {out_path} ({size:,} bytes, {len(trees)} trees)")

export_rf(os.path.join(BASE, "modelo_lsm.pkl"), os.path.join(PUBLIC_DIR, "modelo_letras.json"))
export_rf(os.path.join(BASE, "modelo_palabras.pkl"), os.path.join(PUBLIC_DIR, "modelo_palabras.json"),
          os.path.join(BASE, "label_encoder_palabras.pkl"))
print("Done.")
