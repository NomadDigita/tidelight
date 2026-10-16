-- Advisor-remediation migration assertions.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public' AND left(indexname,4) = 'fki_';
  IF n <> 41 THEN RAISE EXCEPTION 'expected 41 foreign-key indexes, got %', n; END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('community_follows','community_reactions') AND cmd='SELECT') <> 2
  THEN RAISE EXCEPTION 'expected one SELECT policy per public graph table'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND coalesce(qual,'') || ' ' || coalesce(with_check,'') ILIKE '%auth.uid()%'
      AND NOT (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ILIKE '%select auth.uid()%'
  ) THEN RAISE EXCEPTION 'unwrapped auth.uid remains in policy'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.reserve_ai_provider_check()'::regprocedure) THEN
    RAISE EXCEPTION 'public AI quota RPC must be SECURITY INVOKER';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.reserve_support_agent_request()'::regprocedure) THEN
    RAISE EXCEPTION 'public support quota RPC must be SECURITY INVOKER';
  END IF;
  IF NOT has_function_privilege('authenticated','public.reserve_ai_provider_check()','EXECUTE')
     OR has_function_privilege('anon','public.reserve_ai_provider_check()','EXECUTE')
     OR has_function_privilege('anon','private.reserve_ai_provider_check()','EXECUTE') THEN
    RAISE EXCEPTION 'AI quota RPC grants are incorrect';
  END IF;
  IF NOT has_function_privilege('authenticated','public.reserve_support_agent_request()','EXECUTE')
     OR has_function_privilege('anon','public.reserve_support_agent_request()','EXECUTE')
     OR has_function_privilege('anon','private.reserve_support_agent_request()','EXECUTE') THEN
    RAISE EXCEPTION 'support quota RPC grants are incorrect';
  END IF;
END;
$$;

INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE a uuid; b uuid; c uuid; i integer;
BEGIN
  a := public.reserve_ai_provider_check();
  b := public.reserve_ai_provider_check();
  c := public.reserve_ai_provider_check();
  IF a IS NULL OR b IS NULL OR c IS NOT NULL THEN RAISE EXCEPTION 'AI hourly quota changed'; END IF;
  FOR i IN 1..12 LOOP
    IF NOT public.reserve_support_agent_request() THEN RAISE EXCEPTION 'support reservation % unexpectedly denied', i; END IF;
  END LOOP;
  IF public.reserve_support_agent_request() THEN RAISE EXCEPTION 'support hourly quota failed to deny request 13'; END IF;
  INSERT INTO public.community_profiles(id) VALUES ('11111111-1111-4111-8111-111111111111');
  BEGIN
    INSERT INTO public.community_profiles(id) VALUES ('22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'profile ownership policy accepted another user';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
ROLLBACK;
