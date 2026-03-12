-- Add 'Pinterest' to the platform enum used by social_accounts.platform.
-- Finds the enum type from the table column (public or internal schema).

DO $$
DECLARE
  enum_schema text;
  enum_name text;
  is_enum boolean;
BEGIN
  SELECT type_ns.nspname, t.typname, (t.typtype = 'e')
  INTO enum_schema, enum_name, is_enum
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  JOIN pg_namespace type_ns ON t.typnamespace = type_ns.oid
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace table_ns ON c.relnamespace = table_ns.oid
  WHERE c.relname = 'social_accounts'
    AND a.attname = 'platform'
    AND table_ns.nspname IN ('public', 'internal')
    AND a.attnum > 0
    AND NOT a.attisdropped
  LIMIT 1;

  IF enum_name IS NOT NULL AND is_enum THEN
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      enum_schema,
      enum_name,
      'Pinterest'
    );
    RAISE NOTICE 'Added ''Pinterest'' to enum %.%', enum_schema, enum_name;
  ELSE
    RAISE NOTICE 'Column social_accounts.platform is not an enum (or table missing). No change made.';
  END IF;
END $$;
