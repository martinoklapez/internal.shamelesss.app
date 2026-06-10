-- pg_cron runs as postgres; Vault must be readable by invoke_edge_function (SECURITY DEFINER).

grant usage on schema vault to postgres;
grant select on vault.decrypted_secrets to postgres;

do $grant$
begin
  grant usage on schema vault to supabase_admin;
  grant select on vault.decrypted_secrets to supabase_admin;
exception
  when undefined_object then null;
end;
$grant$;

alter function creator_pipeline.invoke_edge_function(text) owner to postgres;
