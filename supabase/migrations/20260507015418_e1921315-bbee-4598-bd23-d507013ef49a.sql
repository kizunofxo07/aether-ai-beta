
-- 1) profiles: restrict SELECT to owner; create public-safe view
DROP POLICY IF EXISTS "public profiles viewable by all" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, username, display_name, description, avatar_url,
       background_color, background_image_url, is_public, plan, created_at
FROM public.profiles
WHERE is_public = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) character_memory: remove public INSERT (edge function uses service role)
DROP POLICY IF EXISTS "anyone create memory" ON public.character_memory;

-- 3) user_roles: restrict SELECT to own user
DROP POLICY IF EXISTS "anyone can read roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 4) avatars bucket: remove unauthenticated upload policy
DROP POLICY IF EXISTS "avatars public upload" ON storage.objects;

-- 5) characters: hide system_prompt from non-owners via view
CREATE OR REPLACE VIEW public.public_characters
WITH (security_invoker = true) AS
SELECT id, owner_id, name, description, greeting, tags, is_official,
       is_owner_official, avatar_url, visibility, category, censorship_level,
       is_remix_of, created_at
FROM public.characters;

GRANT SELECT ON public.public_characters TO anon, authenticated;

-- 6) Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
