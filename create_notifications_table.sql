-- Create notifications table for storing notification history
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text not null check (type in ('episode_release', 'streaming_availability', 'recommendation', 'progress_sync', 'show_status', 'weekly_digest')),
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  read_at timestamp with time zone,
  priority text default 'normal' check (priority in ('high', 'normal', 'low')),
  status text default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Create policies
create policy "Users can view their own notifications"
  on public.notifications for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own notifications"
  on public.notifications for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own notifications"
  on public.notifications for update
  using ( auth.uid() = user_id );

-- Create indexes for better performance
create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_type_idx on public.notifications (type);
create index notifications_status_idx on public.notifications (status);
create index notifications_created_at_idx on public.notifications (created_at desc);
create index notifications_sent_at_idx on public.notifications (sent_at desc);

-- Function to update updated_at timestamp
create or replace function public.update_notifications_updated_at()
returns trigger as $
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$ language plpgsql;

-- Trigger to update updated_at
create trigger update_notifications_updated_at
  before update on public.notifications
  for each row execute procedure public.update_notifications_updated_at();

-- Function to automatically mark notification as sent
create or replace function public.mark_notification_sent()
returns trigger as $
begin
  if new.status = 'sent' and old.status != 'sent' then
    new.sent_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$ language plpgsql;

-- Trigger to set sent_at when status changes to sent
create trigger mark_notification_sent
  before update on public.notifications
  for each row execute procedure public.mark_notification_sent();