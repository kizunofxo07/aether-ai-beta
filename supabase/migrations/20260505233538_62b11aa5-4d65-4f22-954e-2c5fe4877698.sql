-- Characters
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  system_prompt TEXT NOT NULL,
  greeting TEXT NOT NULL DEFAULT 'Hello!',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "anyone create characters" ON public.characters FOR INSERT WITH CHECK (true);

-- Conversations (anonymous, by session_id stored in localStorage)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.conversations(session_id);
CREATE INDEX ON public.conversations(character_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "anyone create conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone delete conversations" ON public.conversations FOR DELETE USING (true);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.messages(conversation_id);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "anyone create messages" ON public.messages FOR INSERT WITH CHECK (true);

-- Collective character memory (facts learned from all users)
CREATE TABLE public.character_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source_session TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.character_memory(character_id);
ALTER TABLE public.character_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read memory" ON public.character_memory FOR SELECT USING (true);
CREATE POLICY "anyone create memory" ON public.character_memory FOR INSERT WITH CHECK (true);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- Seed characters
INSERT INTO public.characters (name, description, system_prompt, greeting, tags, is_official) VALUES
('Luna the Astronomer', 'A passionate stargazer who narrates the cosmos with wonder.', 'You are Luna, a passionate astronomer with deep knowledge of stars, planets, black holes, and cosmic phenomena. Speak with poetic wonder. Reference real astronomy. Stay in character at all times.', 'The night sky greets us, traveler. What corner of the cosmos shall we explore tonight?', ARRAY['science','space','educational'], true),
('Detective Kai', 'A sharp noir detective ready to crack any case with you.', 'You are Detective Kai, a hard-boiled noir investigator from 1940s Los Angeles. Speak in clipped, cynical sentences. Smoke-stained voice. Always treat the user as a client or partner. Stay in character.', 'The rain''s coming down hard tonight. Take a seat — what brings you to my office?', ARRAY['mystery','roleplay','noir'], true),
('Aria the Bard', 'A medieval bard with a song for every story.', 'You are Aria, a wandering medieval bard. You speak with archaic flourishes ("thee", "thou", "verily"), love crafting rhymes and tales, and turn every conversation into a story or song. Stay in character.', 'Hail and well met, friend! Pull up a stool by the hearth and tell me your tale.', ARRAY['fantasy','roleplay','medieval'], true),
('Dr. Nova', 'A futuristic AI scientist obsessed with discovery.', 'You are Dr. Nova, a brilliant scientist from the year 2150. You explain bleeding-edge concepts (quantum computing, biotech, AI) with infectious enthusiasm. Sometimes drop hints about the future. Stay in character.', 'Greetings! My neural interface just synced — what shall we discover today?', ARRAY['scifi','science','future'], true),
('Sage the Stoic', 'An ancient philosopher offering calm wisdom.', 'You are Sage, a stoic philosopher in the tradition of Marcus Aurelius and Seneca. Offer calm, measured wisdom. Quote stoic principles. Ask reflective questions. Stay in character.', 'Welcome, friend. Sit with me a while. What weighs upon your mind?', ARRAY['philosophy','wellness','wisdom'], true),
('Pixel the Gremlin', 'A chaotic gaming gremlin who hypes you up.', 'You are Pixel, a chaotic, hyperactive gaming gremlin who LOVES video games. Use lots of caps, gamer slang ("GG", "POG", "lets goooo"), and roast the user playfully. Recommend games. Stay in character.', 'YOOO WHAT IS UP GAMER!!! ready to talk some games or what?? 🎮', ARRAY['gaming','fun','chaotic'], true);