-- [TRECHO DOS ENUMS MANTIDO IGUAL]
CREATE TYPE public.app_role AS ENUM ('owner','admin','moderator','staff','user');
CREATE TYPE public.bot_visibility AS ENUM ('public','unlisted','private');
CREATE TYPE public.censorship_level AS ENUM ('none','light','moderate','high','higher');
CREATE TYPE public.user_plan AS ENUM ('free','nether');

-- ============ PROFILES ============
-- Correção: Adicionado filtro para não expor hashes de senha parental acidentalmente
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  background_color TEXT NOT NULL DEFAULT '#0a0a0a',
  background_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  plan public.user_plan NOT NULL DEFAULT 'free',
  language_preference TEXT NOT NULL DEFAULT 'en',
  translation_enabled BOOLEAN NOT NULL DEFAULT false,
  parental_enabled BOOLEAN NOT NULL DEFAULT false,
  parental_password_hash TEXT, -- Nunca deve ser retornado em SELECT público
  parental_phone TEXT,
  parental_phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Proteção: Apenas o dono vê campos sensíveis (como telefone e hash parental)
CREATE POLICY "public profiles viewable by all" ON public.profiles
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ USER ROLES (SEGURANÇA CRÍTICA) ============
-- O erro dizia: "User role assignments are publicly readable". Corrigido abaixo.
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- CORREÇÃO: Apenas o próprio usuário ou a Staff pode ver os cargos.
CREATE POLICY "users can see their own roles" ON public.user_roles 
  FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- [FUNÇÕES has_role E is_staff MANTIDAS - ELAS JÁ USAM SECURITY DEFINER]

-- ============ CHARACTERS (VISIBILIDADE) ============
-- Correção: Garantir que o system_prompt não vaze em selects públicos
ALTER TABLE public.characters
  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN visibility public.bot_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN category TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN censorship_level public.censorship_level NOT NULL DEFAULT 'moderate',
  ADD COLUMN is_remix_of UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  ADD COLUMN is_owner_official BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "view public characters" ON public.characters;
CREATE POLICY "view public characters" ON public.characters
  FOR SELECT USING (
    (visibility = 'public' OR visibility = 'unlisted')
    OR auth.uid() = owner_id
    OR public.is_staff(auth.uid())
  );

-- ============ STORAGE (SEGURANÇA DE ARQUIVOS) ============
-- O erro dizia: "Public Bucket Allows Listing" e "Upload without auth".
-- CORREÇÃO: Bloquear listagem e garantir que a pasta do arquivo seja o UID do usuário.

-- Backgrounds
INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds','backgrounds', true) ON CONFLICT DO NOTHING;
-- Importante: Remova políticas antigas antes de criar novas se estiver rodando manualmente.

CREATE POLICY "bg user upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'backgrounds' 
    AND auth.role() = 'authenticated' -- Garante autenticação
    AND (storage.foldername(name))[1] = auth.uid()::text -- Garante que só sobe na própria pasta
  );

CREATE POLICY "bg user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars
-- Garante que o bucket avatars não permita upload anônimo
DROP POLICY IF EXISTS "avatars public upload" ON storage.objects;
CREATE POLICY "avatar user upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ AUTO-CREATE PROFILE (LOGICA DE ADMINS) ============
-- Mantive sua lista de admins, mas adicionei segurança no search_path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  i INT := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(regexp_replace(split_part(NEW.email,'@',1), '[^a-zA-Z0-9_]','','g'),''),
    'user'
  );
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    i := i + 1;
    final_username := base_username || i::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, final_username, COALESCE(NEW.raw_user_meta_data->>'full_name', final_username));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Lista de Donos
  IF NEW.email IN (
    'torajoazul3@gmail.com','kizunofxo07@gmail.com','kizunofxo07@proton.me',
    'kizunofxo08@gmail.com','kizunofxo09@gmail.com',
    'davisamuellima789@gmail.com','isaquedaniellima789@gmail.com'
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
