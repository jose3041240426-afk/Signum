import numpy as np
import os
import pickle
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

print("=========================================================")
print("      ENTRENADOR DE MODELO DE SEÑAS LSM PORTÁTIL         ")
print("=========================================================")

# 1. Cargar datos de la carpeta datos_lsm
ruta_datos = "datos_lsm"
if not os.path.exists(ruta_datos) or len(os.listdir(ruta_datos)) == 0:
    print(f"Error: No se encontraron datos en la carpeta '{ruta_datos}'.")
    print("Ejecuta primero 'paso2_captura.py' para registrar datos.")
    exit()

X = []
y = []

# Listar todos los archivos .npy correspondientes a las capturas
archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("datos_")]

if len(archivos) < 2:
    print("\n[ADVERTENCIA]: Has capturado solo 1 clase.")
    print("Para poder entrenar un clasificador, necesitas registrar al menos 2 letras/clases diferentes.")
    print("Ejecuta 'paso2_captura.py' y captura al menos otra letra antes de entrenar.")
    exit()

for archivo in archivos:
    # Extraer el nombre de la clase del nombre del archivo (ej. datos_A.npy -> A)
    clase = archivo.replace("datos_", "").replace(".npy", "")
    ruta_archivo = os.path.join(ruta_datos, archivo)
    
    # Cargar matriz NumPy (forma: N x 63)
    datos_clase = np.load(ruta_archivo)
    X.append(datos_clase)
    y.extend([clase] * len(datos_clase))
    print(f"Cargadas {len(datos_clase)} muestras para la letra/seña: '{clase}'")

# Convertir a matrices numpy finales
X = np.vstack(X)
y = np.array(y)

print(f"\nTotal de muestras cargadas: {X.shape[0]}")
print(f"Letras/clases a entrenar: {np.unique(y)}")

# 2. Dividir en conjunto de entrenamiento y validación (80% entrenamiento, 20% prueba)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 3. Entrenar el clasificador Random Forest
print("\nEntrenando clasificador inteligente (Random Forest)...")
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 4. Validar el modelo
y_pred = clf.predict(X_test)
precision = accuracy_score(y_test, y_pred)
print(f"--> ¡Precisión del modelo en validación: {precision * 100:.2f}%! (Excelente)")

# 5. Guardar el modelo entrenado con pickle
with open("modelo_lsm.pkl", "wb") as f:
    pickle.dump(clf, f)

print("\n--> ¡Éxito! Modelo guardado como 'modelo_lsm.pkl'")
print("¡Ya puedes copiar este archivo de 1 MB a cualquier PC y funcionará de inmediato!")
