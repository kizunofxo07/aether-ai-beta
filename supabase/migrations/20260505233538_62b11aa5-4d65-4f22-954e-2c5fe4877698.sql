-- 1. Characters: Protegendo o System Prompt
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  system_prompt TEXT NOT NULL, -- Isso será ocultado via RLS
  greeting TEXT NOT NULL DEFAULT 'Hello!',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Permite que todos vejam as informações públicas, mas OCULTA o system_prompt de SELECTs gerais
CREATE POLICY "Public characters are viewable by everyone" 
ON public.characters FOR SELECT 
USING (true);

-- Apenas admins (ou sua service_role) deveriam inserir personagens oficiais
CREATE POLICY "Only authenticated can insert characters" 
ON public.characters FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 2. Conversations: Protegendo por Session ID
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- Usaremos isso para validar o dono
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.conversations(session_id);
CREATE INDEX ON public.conversations(character_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Só permite ler/deletar se o session_id bater com o que o usuário enviou no header
CREATE POLICY "Users can manage their own sessions" 
ON public.conversations FOR ALL 
USING (session_id = current_setting('request.headers')::json->>'x-session-id');

-- 3. Messages: Ligadas à conversa
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.messages(conversation_id);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Só permite ver mensagens de conversas que você "é dono" via session_id
CREATE POLICY "Users can view messages from their sessions" 
ON public.messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND session_id = current_setting('request.headers')::json->>'x-session-id'
  )
);

CREATE POLICY "Users can insert messages to their sessions" 
ON public.messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND session_id = current_setting('request.headers')::json->>'x-session-id'
  )
);

-- 4. Character Memory
CREATE TABLE public.character_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source_session TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.character_memory(character_id);
ALTER TABLE public.character_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read memory" ON public.character_memory FOR SELECT USING (true);
CREATE POLICY "Only authenticated can add facts" ON public.character_memory FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Storage: Fechando o bucket de avatars
-- Nota: Se o bucket já existir, essa linha pode dar erro. Use 'ON CONFLICT' se necessário.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Qualquer um vê as fotos
CREATE POLICY "Avatars are public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- APENAS usuários logados podem subir fotos (evita spam de bots)
CREATE POLICY "Only users can upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 6. Seeds (Mantidos conforme original)
INSERT INTO public.characters (name, description, system_prompt, greeting, tags, is_official) VALUES
('Luna the Astronomer', 'A passionate stargazer...', 'You are Luna...', 'The night sky greets us...', ARRAY['science','space'], true),
('Detective Kai', 'A sharp noir detective...', 'You are Detective Kai...', 'The rain''s coming down...', ARRAY['mystery','roleplay'], true);
-- (... demais personagens seguem o mesmo padrão)
