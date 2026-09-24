-- VEXA V3 SOCIAL-APP MIGRATION
-- Run this after the existing Vexa SQL migrations.
-- This extends the existing project; it does not replace existing tables.

create extension if not exists pgcrypto;

-- Message editing + server-side edit window.
alter table public.messages add column if not exists edited_at timestamptz;

-- Room inactivity / vaporization state. The room itself is deleted after 3 minutes
-- without a new message, so its messages disappear through ON DELETE CASCADE.
alter table public.chat_rooms add column if not exists last_activity_at timestamptz;
alter table public.chat_rooms add column if not exists vaporize_at timestamptz;

create index if not exists chat_rooms_vaporize_idx
on public.chat_rooms(vaporize_at)
where vaporize_at is not null;

create or replace function public.touch_chat_room_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_rooms
  set last_activity_at = now(),
      vaporize_at = now() + interval '3 minutes'
  where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_chat_room on public.messages;
create trigger messages_touch_chat_room
after insert on public.messages
for each row execute function public.touch_chat_room_activity();

-- Reactions: one user can use an emoji once per message.
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint message_reaction_emoji_not_empty check (length(trim(emoji)) > 0),
  constraint message_reaction_emoji_size check (char_length(emoji) <= 16)
);

create unique index if not exists unique_message_user_emoji
on public.message_reactions(message_id, user_id, emoji);
create index if not exists message_reactions_message_idx
on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Users can view chat reactions" on public.message_reactions;
create policy "Users can view chat reactions"
on public.message_reactions for select
using (
  exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = message_reactions.message_id
      and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "Users can add chat reactions" on public.message_reactions;
create policy "Users can add chat reactions"
on public.message_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = message_reactions.message_id
      and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "Users can remove their chat reactions" on public.message_reactions;
create policy "Users can remove their chat reactions"
on public.message_reactions for delete to authenticated
using (user_id = auth.uid());

-- Blocks.
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create unique index if not exists unique_user_block
on public.user_blocks(blocker_id, blocked_id);
create index if not exists user_blocks_blocked_idx
on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view their blocks" on public.user_blocks;
create policy "Users can view their blocks"
on public.user_blocks for select
using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "Users can create blocks" on public.user_blocks;
create policy "Users can create blocks"
on public.user_blocks for insert to authenticated
with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can remove their blocks" on public.user_blocks;
create policy "Users can remove their blocks"
on public.user_blocks for delete to authenticated
using (auth.uid() = blocker_id);

-- Per-chat mute state.
create table if not exists public.chat_mutes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  constraint unique_chat_mute unique(room_id, user_id)
);

create index if not exists chat_mutes_user_idx on public.chat_mutes(user_id);

alter table public.chat_mutes enable row level security;

drop policy if exists "Users can view their mutes" on public.chat_mutes;
create policy "Users can view their mutes"
on public.chat_mutes for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their mutes" on public.chat_mutes;
create policy "Users can create their mutes"
on public.chat_mutes for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "Users can update their mutes" on public.chat_mutes;
create policy "Users can update their mutes"
on public.chat_mutes for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can remove their mutes" on public.chat_mutes;
create policy "Users can remove their mutes"
on public.chat_mutes for delete to authenticated
using (auth.uid() = user_id);

-- Server-side message edit: only the sender and only during the first 10 minutes.
create or replace function public.edit_message(
  target_message_id uuid,
  new_content text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_message public.messages;
begin
  if new_content is null or length(trim(new_content)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  update public.messages
  set content = trim(new_content),
      edited_at = now()
  where id = target_message_id
    and sender_id = auth.uid()
    and created_at >= now() - interval '10 minutes'
  returning * into updated_message;

  if updated_message.id is null then
    raise exception 'Message cannot be edited after 10 minutes or is not yours';
  end if;

  return updated_message;
end;
$$;

grant execute on function public.edit_message(uuid,text) to authenticated;

-- Server-side reaction toggle.
create or replace function public.toggle_message_reaction(
  target_message_id uuid,
  target_emoji text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_member boolean;
begin
  select exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = target_message_id
      and (r.user_a = auth.uid() or r.user_b = auth.uid())
  ) into room_member;

  if not room_member then
    raise exception 'You are not a member of this chat';
  end if;

  if exists (
    select 1 from public.message_reactions
    where message_id = target_message_id
      and user_id = auth.uid()
      and emoji = target_emoji
  ) then
    delete from public.message_reactions
    where message_id = target_message_id
      and user_id = auth.uid()
      and emoji = target_emoji;
  else
    insert into public.message_reactions(message_id,user_id,emoji)
    values(target_message_id,auth.uid(),target_emoji);
  end if;
end;
$$;

grant execute on function public.toggle_message_reaction(uuid,text) to authenticated;

-- Block-aware message and request protection.
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
on public.messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.chat_rooms r
    where r.id = messages.room_id
      and (r.user_a = auth.uid() or r.user_b = auth.uid())
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = case when r.user_a = auth.uid() then r.user_b else r.user_a end)
           or (b.blocked_id = auth.uid() and b.blocker_id = case when r.user_a = auth.uid() then r.user_b else r.user_a end)
      )
  )
);

drop policy if exists "Users can send requests" on public.connection_requests;
create policy "Users can send requests"
on public.connection_requests for insert to authenticated
with check (
  auth.uid() = sender_id
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = receiver_id)
       or (b.blocked_id = auth.uid() and b.blocker_id = receiver_id)
  )
);

-- Vaporize the complete room. Deleting the room cascades to messages/reactions/mutes.
create or replace function public.vaporize_chat_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chat_rooms
    where id = target_room_id
      and (user_a = auth.uid() or user_b = auth.uid())
  ) then
    raise exception 'You are not a member of this chat';
  end if;

  delete from public.chat_rooms where id = target_room_id;
end;
$$;

grant execute on function public.vaporize_chat_room(uuid) to authenticated;

-- Automatically remove inactive conversations every minute.
-- Supabase projects with pg_cron enabled can run this schedule.
create extension if not exists pg_cron;
select cron.schedule(
  'vexa-vaporize-inactive-chats',
  '* * * * *',
  $$delete from public.chat_rooms where vaporize_at is not null and vaporize_at <= now()$$
)
where not exists (
  select 1 from cron.job where jobname = 'vexa-vaporize-inactive-chats'
);

-- Realtime for reactions, blocks, mutes and room deletion/activity.
begin;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.user_blocks;
alter publication supabase_realtime add table public.chat_mutes;
commit;
