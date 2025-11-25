-- 1. Check if the trigger exists and drop it to be safe
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 2. Re-create the function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- 3. Re-create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Backfill missing profiles for existing users
insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
where id not in (select id from public.profiles);

-- 5. Verify
select count(*) as auth_users_count from auth.users;
select count(*) as profiles_count from public.profiles;
