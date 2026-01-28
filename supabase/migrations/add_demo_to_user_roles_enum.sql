-- Add 'demo' to the role enum used by user_roles.role.
-- Finds the enum type from the table column, so it works regardless of type name.
-- If user_roles.role is text with a CHECK constraint instead of an enum,
-- this does nothing (see NOTICE); add 'demo' to that constraint manually if needed.

DO $$
DECLARE
  enum_schema text;
  enum_name text;
  is_enum boolean;
BEGIN
  SELECT n.nspname, t.typname, (t.typtype = 'e')
  INTO enum_schema, enum_name, is_enum
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relname = 'user_roles'
    AND a.attname = 'role'
    AND n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF enum_name IS NOT NULL AND is_enum THEN
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      enum_schema,
      enum_name,
      'demo'
    );
    RAISE NOTICE 'Added ''demo'' to enum %.%', enum_schema, enum_name;
  ELSE
    RAISE NOTICE 'Column user_roles.role is not an enum (or table missing). No change made.';
  END IF;
END $$;
