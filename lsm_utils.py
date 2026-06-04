import math

def normalize_landmarks(hand_landmarks):
    """
    Normaliza las coordenadas de los landmarks de la mano para hacerlas:
    1. Invariantes de Traslación (la muñeca siempre es el origen 0,0,0)
    2. Invariantes de Escalado (independiente de la distancia a la cámara y resolución)
    
    Retorna una lista plana de 63 elementos (21 puntos x 3 ejes X, Y, Z).
    """
    landmarks = hand_landmarks.landmark
    
    # 1. Obtener las coordenadas de la muñeca (punto 0)
    base_x = landmarks[0].x
    base_y = landmarks[0].y
    base_z = landmarks[0].z
    
    # 2. Traslación: Restar las coordenadas de la muñeca a todos los puntos
    translated_coords = []
    for lm in landmarks:
        translated_coords.append([
            lm.x - base_x,
            lm.y - base_y,
            lm.z - base_z
        ])
        
    # 3. Escalado: Calcular la distancia máxima de cualquier punto a la muñeca
    max_dist = 0.0
    for coords in translated_coords:
        dist = math.sqrt(coords[0]**2 + coords[1]**2 + coords[2]**2)
        if dist > max_dist:
            max_dist = dist
            
    # Evitar división por cero
    if max_dist == 0.0:
        max_dist = 1.0
        
    # 4. Escalar y aplanar los datos en un solo vector de 63 dimensiones
    normalized_flat = []
    for coords in translated_coords:
        normalized_flat.extend([
            coords[0] / max_dist,
            coords[1] / max_dist,
            coords[2] / max_dist
        ])
        
    return normalized_flat
