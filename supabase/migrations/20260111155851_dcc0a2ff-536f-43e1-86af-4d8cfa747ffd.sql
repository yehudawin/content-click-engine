
-- Add INSERT policy to prevent users from creating profiles for other user_ids
CREATE POLICY "Users can only create their own profile" ON public.profiles 
  FOR INSERT WITH CHECK (user_id = auth.uid());
