# Proyecto LSM

Sistema de reconocimiento de la Lengua de Señas Mexicana (LSM) mediante visión por computadora.

## Descripción

Este proyecto captura la configuración de la mano en tiempo real a través de una cámara web, procesa los puntos clave con **MediaPipe Hands** y los almacena para entrenar un modelo de **Random Forest** (letras) o una **red LSTM** (palabras). El backend es una API construida con **FastAPI** y el frontend es una aplicación web desarrollada en **Next.js** con **React** y **Tailwind CSS**.

---

## Requisitos Previos

Asegúrate de tener instalados en tu máquina:

- **Python** 3.10 o superior (recomendado 3.10 - 3.11)
- **Node.js** 18 o superior (recomendado 18.x LTS o 20.x LTS)
- **Git**

---

## Estructura del Proyecto

```
.
├── backend/                # API de Python (FastAPI)
├── frontend/               # Aplicación web (Next.js + React)
├── datos_lsm/              # Datos de entrenamiento de letras
├── datos_palabras/         # Datos de entrenamiento de palabras
├── modelo_lsm.pkl          # Modelo de letras entrenado (generado)
├── modelo_palabras.pkl     # Modelo de palabras entrenado (generado)
├── requirements.txt        # Dependencias de Python
└── INSTRUCCIONES.txt       # Guía rápida de ejecución
```

---

## Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone https://github.com/USUARIO/REPO.git
cd REPO
```

### 2. Crear y Activar Entorno Virtual

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar Dependencias de Python

Con el entorno virtual activado:

```bash
pip install -r requirements.txt
```

| Paquete | Descripción |
| --- | --- |
| `numpy` | Cálculos numéricos y manejo de arrays |
| `opencv-python` | Captura y procesamiento de video (cámara) |
| `mediapipe` | Detección de landmarks de manos en tiempo real |
| `fastapi` | Framework para la API REST |
| `uvicorn` | Servidor ASGI para ejecutar FastAPI |
| `pydantic` | Validación de datos y modelos |
| `gtts` | Texto a voz (Google Text-to-Speech) |
| `scikit-learn` | Entrenamiento del modelo de letras (Random Forest) |
| `tensorflow` | Entrenamiento del modelo de palabras (LSTM con Keras) |
| `python-multipart` | Soporte para subida de archivos en FastAPI |

### 4. Instalar Dependencias del Frontend

```bash
cd frontend
npm install
```

| Paquete | Descripción |
| --- | --- |
| `next` | Framework React para la aplicación web |
| `react` / `react-dom` | Librerías de interfaz de usuario |
| `@mediapipe/holistic` | Soluciones de MediaPipe para el navegador |
| `@mediapipe/tasks-vision` | Tareas de visión de MediaPipe |
| `tailwindcss` | Framework de estilos CSS |
| `typescript` | Tipado estático para JavaScript |
| `eslint` | Linter de código |

---

## Ejecución del Proyecto

### 1. Iniciar el Servidor Backend (FastAPI)

Desde la raíz del proyecto, con el entorno virtual activado:

```bash
uvicorn backend.app.main:app --reload --reload-dir backend --port 8000
```

O también:

```bash
python -m uvicorn backend.app.main:app --reload --reload-dir backend --port 8000
```

> **Importante:** El flag `--reload-dir backend` es necesario para que el *watcher* solo observe la carpeta `backend`. Sin él, uvicorn intenta vigilar todo el directorio (incluyendo `venv/` y `node_modules/`) y puede fallar en Windows.

- El backend se levantará en: `http://localhost:8000`

### 2. Iniciar el Frontend (Next.js)

En una nueva terminal (sin cerrar el backend):

```bash
cd frontend
npm run dev
```

- El frontend se levantará en: `http://localhost:3000`

### 3. Uso

1. Abre `http://localhost:3000` en tu navegador.
2. La cámara se activará automáticamente.
3. El backend se conecta al frontend mediante la API en el puerto 8000.

---

## Notas Importantes

- **Modo Demo:** Si el modelo (`modelo_lsm.pkl`) no existe, el backend correrá en "modo demo".
- **Índice de Cámara:** Si cambias de computadora, es posible que necesites ajustar el índice de la cámara (por defecto es `0`, con fallback al `1`).
- **Desactivar entorno virtual:** `deactivate`
- **Precarga de TTS:** La primera vez que se ejecute el backend, el texto a voz (TTS) precargará los audios de las letras en segundo plano; esto puede tomar unos segundos.
- **Archivos Ignorados:** Las carpetas `venv/` y `node_modules/` están ignoradas en Git (ver `.gitignore`). Por eso es obligatorio recrear el entorno e instalar dependencias al clonar.

---

## Créditos

Proyecto desarrollado para la detección y reconocimiento de la Lengua de Señas Mexicana (LSM) mediante Inteligencia Artificial y Visión por Computadora.
