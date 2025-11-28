-- Create notification_preferences table
create table public.notification_preferences (
  user_id uuid references auth.users not null primary key,
  episode_releases boolean default true,
  streaming_updates boolean default true,
  recommendations boolean default true,
  progress_sync boolean default true,
  quiet_hours jsonb default '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb,
  frequency text default 'immediate' check (frequency in ('immediate', 'daily', 'weekly')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notification_preferences enable row level security;

-- Create policies
create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  using ( auth.uid() = user_id );

-- Function to create default notification preferences for new users
create or replace function public.create_default_notification_preferences()
returns trigger as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create default preferences when user is created
create trigger on_auth_user_created_notification_prefs
  after insert on auth.users
  for each row execute procedure public.create_default_notification_preferences();

-- Function to update updated_at timestamp
create or replace function public.update_notification_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at
create trigger update_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.update_notification_preferences_updated_at();