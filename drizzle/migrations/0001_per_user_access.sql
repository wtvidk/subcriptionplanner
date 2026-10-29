GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_reads TO authenticated;
CREATE POLICY "own subs" ON public.subscriptions FOR ALL TO authenticated USING (profile_id = auth.uid()::text) WITH CHECK (profile_id = auth.uid()::text);
CREATE POLICY "own settings" ON public.reminder_settings FOR ALL TO authenticated USING (profile_id = auth.uid()::text) WITH CHECK (profile_id = auth.uid()::text);
CREATE POLICY "own reads" ON public.reminder_reads FOR ALL TO authenticated USING (profile_id = auth.uid()::text) WITH CHECK (profile_id = auth.uid()::text);