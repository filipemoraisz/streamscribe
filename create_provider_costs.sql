-- Create provider_costs table
create table provider_costs (
  provider_id text primary key,
  provider_name text not null,
  monthly_cost numeric not null,
  currency text default 'USD',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table provider_costs enable row level security;

-- Policies
create policy "Provider costs are viewable by everyone." on provider_costs for select using (true);
create policy "Only admins can update costs." on provider_costs for all using (false); -- Read-only for now

-- Seed initial data
insert into provider_costs (provider_id, provider_name, monthly_cost) values
  ('8', 'Netflix', 15.49),
  ('9', 'Amazon Prime Video', 14.98),
  ('337', 'Disney Plus', 13.99),
  ('384', 'HBO Max', 15.99),
  ('15', 'Hulu', 14.99),
  ('2', 'Apple TV+', 6.99),
  ('283', 'Crunchyroll', 5.99),
  ('531', 'Paramount+', 9.99),
  ('387', 'Peacock', 4.99),
  ('350', 'Apple TV', 12.99)
on conflict (provider_id) do update 
set monthly_cost = excluded.monthly_cost;
