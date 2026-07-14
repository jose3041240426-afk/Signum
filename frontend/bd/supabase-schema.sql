-- =============================================
-- SIGNUM - Esquema completo para Supabase
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- =============================================
-- ATENCIÓN: Estos comandos borrarán las tablas existentes y todos sus datos.
-- =============================================
DROP TABLE IF EXISTS public.avances CASCADE;
DROP TABLE IF EXISTS public.traducciones CASCADE;
DROP TABLE IF EXISTS public.login CASCADE;
DROP TABLE IF EXISTS public.usuario_roles CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.catalogo_tipo_traduccion CASCADE;
DROP TABLE IF EXISTS public.catalogo_generos CASCADE;

-- 1. Tablas de catálogo
-- -----------------------------------------

CREATE TABLE public.catalogo_generos (
  id_genero serial PRIMARY KEY,
  genero varchar(20) NOT NULL
);

CREATE TABLE public.catalogo_tipo_traduccion (
  id_tipo serial PRIMARY KEY,
  tipo varchar(30) NOT NULL
);

CREATE TABLE public.roles (
  id_rol serial PRIMARY KEY,
  nombre_rol varchar(50) NOT NULL
);

-- 2. Tabla de usuarios (vinculada a auth.users)
-- -----------------------------------------
-- id_usuario = UUID de auth.users (Supabase Auth)
-- NOTA: Se ha omitido el campo "contrasena" ya que en Supabase las contraseñas 
-- se gestionan internamente en la tabla auth.users para mayor seguridad.

CREATE TABLE public.usuarios (
  id_usuario uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre varchar(50) NOT NULL,
  apellido_paterno varchar(50) NOT NULL,
  apellido_materno varchar(50) DEFAULT '',
  correo varchar(100) NOT NULL UNIQUE,
  estado boolean DEFAULT true,
  fecha_registro date DEFAULT CURRENT_DATE,
  id_genero integer NOT NULL REFERENCES public.catalogo_generos(id_genero)
);

-- 3. Tabla intermedia para Usuarios y Roles
-- -----------------------------------------

CREATE TABLE public.usuario_roles (
  id_usuario_rol serial PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  id_rol integer NOT NULL REFERENCES public.roles(id_rol) ON DELETE CASCADE,
  fecha_asignacion date DEFAULT CURRENT_DATE
);

-- 4. Tablas de actividad
-- -----------------------------------------

CREATE TABLE public.login (
  id_login serial PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  fecha_hora timestamp DEFAULT CURRENT_TIMESTAMP,
  direccion_ip varchar(50)
);

CREATE TABLE public.traducciones (
  id_traduccion serial PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  id_tipo integer NOT NULL REFERENCES public.catalogo_tipo_traduccion(id_tipo),
  texto_original text NOT NULL,
  texto_traducido text NOT NULL,
  fecha_hora timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.avances (
  id_avance serial PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  traducciones_realizadas integer DEFAULT 0,
  tiempo_uso_minutos integer DEFAULT 0,
  fecha date DEFAULT CURRENT_DATE
);

-- =============================================
-- SEED DATA
-- =============================================

INSERT INTO public.catalogo_generos (genero) VALUES
  ('Hombre'),
  ('Mujer'),
  ('Otro');

INSERT INTO public.roles (nombre_rol) VALUES
  ('Administrador'),
  ('Usuario');

INSERT INTO public.catalogo_tipo_traduccion (tipo) VALUES
  ('LSM-TEXTO'),
  ('TEXTO-VOZ'),
  ('VOZ-TEXTO');

-- =============================================
-- TRIGGER: crear perfil y rol automáticamente al registrarse
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  default_role_id int;
BEGIN
  -- Insertar perfil del usuario
  INSERT INTO public.usuarios (id_usuario, nombre, apellido_paterno, apellido_materno, correo, id_genero)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido_paterno', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido_materno', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'id_genero')::int, 1)
  );

  -- Asignar rol por defecto (Usuario = id 2)
  default_role_id := COALESCE((NEW.raw_user_meta_data ->> 'id_rol')::int, 2);

  INSERT INTO public.usuario_roles (id_usuario, id_rol)
  VALUES (NEW.id, default_role_id);

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Si el perfil falla, el login de Supabase NO se bloquea
    RAISE WARNING 'handle_new_user: error al crear perfil para %, SQLSTATE: %, SQLERRM: %', NEW.id, SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traducciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_generos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_tipo_traduccion ENABLE ROW LEVEL SECURITY;

-- Catálogos: cualquier usuario autenticado puede leer
CREATE POLICY "Usuarios autenticados pueden leer géneros"
  ON public.catalogo_generos FOR SELECT
  USING (auth.role() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden leer roles"
  ON public.roles FOR SELECT
  USING (auth.role() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden leer tipos de traducción"
  ON public.catalogo_tipo_traduccion FOR SELECT
  USING (auth.role() IS NOT NULL);

-- Usuarios: solo pueden leer/editar su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON public.usuarios FOR SELECT
  USING (auth.uid() = id_usuario);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON public.usuarios FOR UPDATE
  USING (auth.uid() = id_usuario);

-- Usuario Roles: solo pueden ver sus propios roles
CREATE POLICY "Usuarios pueden ver sus propios roles"
  ON public.usuario_roles FOR SELECT
  USING (auth.uid() = id_usuario);

-- Login: solo pueden insertar y leer sus propios registros
CREATE POLICY "Usuarios pueden insertar sus propios logins"
  ON public.login FOR INSERT
  WITH CHECK (auth.uid() = id_usuario);

CREATE POLICY "Usuarios pueden ver sus propios logins"
  ON public.login FOR SELECT
  USING (auth.uid() = id_usuario);

-- Traducciones: solo pueden ver/insertar sus propias traducciones
CREATE POLICY "Usuarios pueden insertar sus propias traducciones"
  ON public.traducciones FOR INSERT
  WITH CHECK (auth.uid() = id_usuario);

CREATE POLICY "Usuarios pueden ver sus propias traducciones"
  ON public.traducciones FOR SELECT
  USING (auth.uid() = id_usuario);

-- Avances: solo pueden ver/insertar sus propios avances
CREATE POLICY "Usuarios pueden insertar sus propios avances"
  ON public.avances FOR INSERT
  WITH CHECK (auth.uid() = id_usuario);

CREATE POLICY "Usuarios pueden ver sus propios avances"
  ON public.avances FOR SELECT
  USING (auth.uid() = id_usuario);

CREATE POLICY "Usuarios pueden actualizar sus propios avances"
  ON public.avances FOR UPDATE
  USING (auth.uid() = id_usuario);

-- =============================================
-- Permisos
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
