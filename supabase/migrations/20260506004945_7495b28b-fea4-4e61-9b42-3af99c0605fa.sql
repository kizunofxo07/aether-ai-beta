
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','moderator','staff','user');
CREATE TYPE public.bot_visibility AS ENUM ('public','unlisted','private');
CREATE TYPE public.censorship_level AS ENUM ('none','light','moderate','high','higher');
CREATE TYPE public.user_plan AS ENUM ('free','nether');

-- ============ PROFILES ============
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
  parental_password_hash TEXT,
  parental_phone TEXT,
  parental_phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public profiles viewable by all" ON public.profiles
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read roles" ON public.user_roles FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('owner','admin','moderator','staff'))
$$;

-- ============ CHARACTERS UPDATES ============
ALTER TABLE public.characters
  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN visibility public.bot_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN category TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN censorship_level public.censorship_level NOT NULL DEFAULT 'moderate',
  ADD COLUMN is_remix_of UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  ADD COLUMN is_owner_official BOOLEAN NOT NULL DEFAULT false;

-- mark existing characters as site-owned & official
UPDATE public.characters SET is_official = true, is_owner_official = true, owner_id = NULL;

-- replace anonymous insert policy with proper rules
DROP POLICY IF EXISTS "anyone create characters" ON public.characters;
DROP POLICY IF EXISTS "anyone read characters" ON public.characters;

CREATE POLICY "view public characters" ON public.characters
  FOR SELECT USING (
    visibility = 'public'
    OR visibility = 'unlisted'
    OR auth.uid() = owner_id
    OR public.is_staff(auth.uid())
  );
CREATE POLICY "auth users create characters" ON public.characters
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update characters" ON public.characters
  FOR UPDATE USING (auth.uid() = owner_id OR public.is_staff(auth.uid()));
CREATE POLICY "owners delete characters" ON public.characters
  FOR DELETE USING (auth.uid() = owner_id OR public.is_staff(auth.uid()));

-- ============ REMIX REQUESTS ============
CREATE TABLE public.remix_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.remix_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own remix requests" ON public.remix_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);
CREATE POLICY "create remix request" ON public.remix_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "owner updates status" ON public.remix_requests
  FOR UPDATE USING (auth.uid() = owner_id);

-- ============ STAFF CONTENT (owner-editable HTML block) ============
CREATE TABLE public.staff_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  html TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.staff_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads staff content" ON public.staff_content FOR SELECT USING (true);
CREATE POLICY "owners write staff content" ON public.staff_content
  FOR ALL USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

INSERT INTO public.staff_content (slug, html) VALUES
  ('staff-page', '<h2>Welcome to Æther Staff</h2><p>This block is editable by the project owners.</p>');

-- ============ CONVERSATIONS / MESSAGES — link to user when logged in ============
ALTER TABLE public.conversations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "anyone read conversations" ON public.conversations;
DROP POLICY IF EXISTS "anyone create conversations" ON public.conversations;
DROP POLICY IF EXISTS "anyone delete conversations" ON public.conversations;

CREATE POLICY "view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));
CREATE POLICY "create own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR (user_id IS NULL));
CREATE POLICY "delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

DROP POLICY IF EXISTS "anyone read messages" ON public.messages;
DROP POLICY IF EXISTS "anyone create messages" ON public.messages;

CREATE POLICY "messages by owning conversation" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.user_id = auth.uid() OR (c.user_id IS NULL AND auth.uid() IS NULL)))
  );
CREATE POLICY "create messages in own conv" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.user_id = auth.uid() OR (c.user_id IS NULL)))
  );

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- auto-grant owner role to listed emails
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- backgrounds bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds','backgrounds', true) ON CONFLICT DO NOTHING;
CREATE POLICY "bg public read" ON storage.objects FOR SELECT USING (bucket_id = 'backgrounds');
CREATE POLICY "bg user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bg user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bg user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

-- avatar policies (avatars bucket already exists, public)
CREATE POLICY "avatar user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatar user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
