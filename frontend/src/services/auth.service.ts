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

  await supabase.from("login").insert({
    id_usuario: data.user.id,
    direccion_ip: "",
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
