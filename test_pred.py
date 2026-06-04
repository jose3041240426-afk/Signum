import pickle
import numpy as np
try:
    with open('modelo_lsm.pkl', 'rb') as f:
        model = pickle.load(f)
    print("Classes:", model.classes_)
    
    # 63 features dummy
    dummy_data = np.random.rand(63).tolist()
    pred = model.predict([dummy_data])[0]
    probs = model.predict_proba([dummy_data])[0]
    idx_max = np.argmax(probs)
    this_conf = float(probs[idx_max] * 100)
    print(f"Pred: {pred}, Conf: {this_conf}")
except Exception as e:
    print("Error:", e)
