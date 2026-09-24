alter table public.profiles add column if not exists profile_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists show_activity boolean not null default true;
alter table public.profiles add column if not exists read_receipts boolean not null default true;
alter table public.profiles add column if not exists notifications_enabled boolean not null default true;

update public.profiles set updated_at=coalesce(updated_at,created_at,now()) where updated_at is null;

insert into storage.buckets(id,name,public)
values('avatars','avatars',true)
on conflict(id) do update set public=true;

drop policy if exists "vexa avatars public read" on storage.objects;
drop policy if exists "vexa avatars upload own" on storage.objects;
drop policy if exists "vexa avatars update own" on storage.objects;
drop policy if exists "vexa avatars delete own" on storage.objects;

create policy "vexa avatars public read"
on storage.objects for select
using(bucket_id='avatars');

create policy "vexa avatars upload own"
on storage.objects for insert to authenticated
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "vexa avatars update own"
on storage.objects for update to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "vexa avatars delete own"
on storage.objects for delete to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
