import { supabase } from "@/lib/supabase";

export async function signUp(
  email: string,
  password: string,
  nombre: string,
  apellido_paterno: string,
  apellido_materno: string,
  id_genero: number,
) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre,
        apellido_paterno,
        apellido_materno,
        id_genero,
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("No se pudo crear el usuario");

  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Intentar obtener la IP real
  let ip = "Desconocida";
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const json = await res.json();
      ip = json.ip;
    }
  } catch (e) {
    console.error("No se pudo obtener la IP:", e);
  }

  await supabase.from("login").insert({
    id_usuario: data.user.id,
    direccion_ip: ip,
  });

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getGeneros() {
  const { data, error } = await supabase
    .from("catalogo_generos")
    .select("*")
    .order("id_genero");
  if (error) throw error;
  return data;
}

export async function getRoles() {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("id_rol");
  if (error) throw error;
  return data;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, catalogo_generos(genero)")
    .eq("id_usuario", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUserRoles(userId: string) {
  const { data, error } = await supabase
    .from("usuario_roles")
    .select("*, roles(nombre_rol)")
    .eq("id_usuario", userId);
  if (error) throw error;
  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: { nombre: string; apellido_paterno: string; apellido_materno?: string; id_genero: number }
) {
  const { data, error } = await supabase
    .from("usuarios")
    .update(updates)
    .eq("id_usuario", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserStats(userId: string) {
  const { data, error } = await supabase
    .from("avances")
    .select("*")
    .eq("id_usuario", userId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getUserTranslations(userId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from("traducciones")
    .select("*, catalogo_tipo_traduccion(tipo)")
    .eq("id_usuario", userId)
    .order("fecha_hora", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getUserLogins(userId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from("login")
    .select("*")
    .eq("id_usuario", userId)
    .order("fecha_hora", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function recordTranslation(userId: string, id_tipo: number, texto_original: string, texto_traducido: string) {
  // 1. Insertar la traducción
  const { error: transError } = await supabase.from("traducciones").insert({
    id_usuario: userId,
    id_tipo,
    texto_original,
    texto_traducido,
  });
  if (transError) throw transError;

  // 2. Actualizar avances (traducciones_realizadas)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Buscar si ya existe un registro de hoy
  const { data: avanceData, error: avanceError } = await supabase
    .from("avances")
    .select("*")
    .eq("id_usuario", userId)
    .eq("fecha", today)
    .single();

  if (avanceError && avanceError.code !== 'PGRST116') {
    // Error diferente a "no encontrado"
    throw avanceError;
  }

  if (!avanceData) {
    // Insertar nuevo registro
    await supabase.from("avances").insert({
      id_usuario: userId,
      fecha: today,
      traducciones_realizadas: 1,
      tiempo_uso_minutos: 0
    });
  } else {
    // Actualizar registro existente
    await supabase.from("avances").update({
      traducciones_realizadas: (avanceData.traducciones_realizadas || 0) + 1
    }).eq("id_avance", avanceData.id_avance);
  }
}

export async function recordActiveTime(userId: string, minutesToAdd: number = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: avanceData, error: avanceError } = await supabase
    .from("avances")
    .select("*")
    .eq("id_usuario", userId)
    .eq("fecha", today)
    .single();

  if (avanceError && avanceError.code !== 'PGRST116') {
    throw avanceError;
  }

  if (!avanceData) {
    await supabase.from("avances").insert({
      id_usuario: userId,
      fecha: today,
      traducciones_realizadas: 0,
      tiempo_uso_minutos: minutesToAdd
    });
  } else {
    await supabase.from("avances").update({
      tiempo_uso_minutos: (avanceData.tiempo_uso_minutos || 0) + minutesToAdd
    }).eq("id_avance", avanceData.id_avance);
  }
}
