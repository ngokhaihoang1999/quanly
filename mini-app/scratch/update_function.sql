drop function if exists get_unread_chats(text);

create or replace function get_unread_chats(user_code text)
returns table(profile_id uuid, has_mention boolean) as $$
begin
  return query
  select c.profile_id,
         coalesce(bool_or(c.message like '%' || '@' || user_code || '%'), false) as has_mention
  from profile_chats c
  left join profile_chat_reads r on c.profile_id = r.profile_id and r.staff_code = user_code
  where c.sender_code != user_code
    and (r.last_read_at is null or c.created_at > r.last_read_at)
  group by c.profile_id;
end;
$$ language plpgsql security definer;
