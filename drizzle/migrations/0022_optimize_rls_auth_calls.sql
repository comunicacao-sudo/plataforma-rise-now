-- Evaluate auth context once per statement instead of once per scanned row.
-- Policy expressions are preserved verbatim apart from wrapping auth.uid().

DO $$
DECLARE
  policy_record record;
  using_expression text;
  check_expression text;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
      )
  LOOP
    using_expression := CASE
      WHEN policy_record.qual IS NULL THEN NULL
      ELSE replace(policy_record.qual, 'auth.uid()', '(select auth.uid())')
    END;
    check_expression := CASE
      WHEN policy_record.with_check IS NULL THEN NULL
      ELSE replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())')
    END;

    IF using_expression IS NOT NULL AND check_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        using_expression,
        check_expression
      );
    ELSIF using_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        using_expression
      );
    ELSIF check_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        check_expression
      );
    END IF;
  END LOOP;
END $$;
