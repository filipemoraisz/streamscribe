-- Create user_preferences table
create table public.user_preferences (
  user_id uuid references auth.users not null primary key,
  subscribed_services text[] default '{}', -- Array of provider IDs
  weekly_watch_hours integer default 10,
  monthly_budget numeric default 50.00,
  onboarding_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_preferences enable row level security;

-- Create policies
create policy "Users can view their own preferences"
  on public.user_preferences for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using ( auth.uid() = user_id );

-- Function to handle new user creation (optional, if you want to auto-create empty prefs)
-- For now, we'll create it during onboarding.
