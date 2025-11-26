-- Episode Progress Table
create table episode_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  show_id integer not null,
  season_number integer not null,
  episode_number integer not null,
  watched boolean default false,
  watched_date timestamp with time zone default timezone('utc'::text, now()),
  rating integer check (rating >= 1 and rating <= 10),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, show_id, season_number, episode_number)
);

-- Show Progress Table (Summary)
create table show_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  show_id integer not null,
  current_season integer default 1,
  current_episode integer default 1,
  total_watched_episodes integer default 0,
  last_watched_date timestamp with time zone default timezone('utc'::text, now()),
  status text check (status in ('watching', 'completed', 'dropped', 'plan_to_watch')) default 'watching',
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, show_id)
);

-- RLS Policies
alter table episode_progress enable row level security;
alter table show_progress enable row level security;

-- Episode Progress Policies
create policy "Users can see own episode progress." on episode_progress for select using (auth.uid() = user_id);
create policy "Users can insert own episode progress." on episode_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own episode progress." on episode_progress for update using (auth.uid() = user_id);
create policy "Users can delete own episode progress." on episode_progress for delete using (auth.uid() = user_id);

-- Show Progress Policies
create policy "Users can see own show progress." on show_progress for select using (auth.uid() = user_id);
create policy "Users can insert own show progress." on show_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own show progress." on show_progress for update using (auth.uid() = user_id);
create policy "Users can delete own show progress." on show_progress for delete using (auth.uid() = user_id);
