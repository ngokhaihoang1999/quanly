-- Create profile_chats table to store messages
create table if not exists profile_chats (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  sender_code text not null,
  message text not null,
  category text default 'general',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Create profile_chat_reads table to track message read status for each JD code
create table if not exists profile_chat_reads (
  profile_id uuid references profiles(id) on delete cascade not null,
  staff_code text not null,
  last_read_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (profile_id, staff_code)
);

-- Enable Row Level Security (RLS)
alter table profile_chats enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'profile_chats' and policyname = 'Allow all to profile_chats'
  ) then
    create policy "Allow all to profile_chats" on profile_chats for all using (true) with check (true);
  end if;
end;
$$;

alter table profile_chat_reads enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'profile_chat_reads' and policyname = 'Allow all to profile_chat_reads'
  ) then
    create policy "Allow all to profile_chat_reads" on profile_chat_reads for all using (true) with check (true);
  end if;
end;
$$;

-- Create function to get list of profile_ids that have unread chats for a user
create or replace function get_unread_chats(user_code text)
returns table(profile_id uuid) as $$
begin
  return query
  select distinct c.profile_id
  from profile_chats c
  left join profile_chat_reads r on c.profile_id = r.profile_id and r.staff_code = user_code
  where c.sender_code != user_code
    and (r.last_read_at is null or c.created_at > r.last_read_at);
end;
$$ language plpgsql security definer;

-- Enable Supabase Realtime for profile_chats
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Check if table is already in publication to avoid duplicate errors
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_chats'
    ) then
      alter publication supabase_realtime add table profile_chats;
    end if;
  end if;
end;
$$;
