-- Create a table to track user impact and stats
create table public.user_impact_stats (
  user_id uuid references auth.users not null primary key,
  total_savings decimal(10, 2) default 0.00,
  optimized_hours decimal(10, 2) default 0.00,
  current_streak integer default 0,
  monthly_efficiency decimal(5, 2) default 0.00, -- Cost per hour
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.user_impact_stats enable row level security;

-- Create policies
create policy "Users can view their own stats"
  on public.user_impact_stats for select
  using (auth.uid() = user_id);

create policy "Users can update their own stats"
  on public.user_impact_stats for update
  using (auth.uid() = user_id);

create policy "Users can insert their own stats"
  on public.user_impact_stats for insert
  with check (auth.uid() = user_id);

-- Function to automatically update timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.last_updated = now();
  return new;
end;
$$ language plpgsql;

create trigger on_stats_updated
  before update on public.user_impact_stats
  for each row execute procedure public.handle_updated_at();
