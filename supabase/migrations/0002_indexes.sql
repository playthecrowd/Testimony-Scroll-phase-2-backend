-- Indexes for frequently queried foreign keys and filter columns.

create index church_memberships_profile_id_idx on public.church_memberships (profile_id);
create index church_memberships_church_id_idx on public.church_memberships (church_id);
create index church_memberships_church_profile_role_idx
  on public.church_memberships (church_id, profile_id, role);

create index speakers_church_id_idx on public.speakers (church_id);

create index lessons_church_id_idx on public.lessons (church_id);
create index lessons_speaker_id_idx on public.lessons (speaker_id);
create index lessons_status_idx on public.lessons (status);
create index lessons_slug_idx on public.lessons (slug);
create index lessons_church_id_status_idx on public.lessons (church_id, status);

create index lesson_media_lesson_id_idx on public.lesson_media (lesson_id);
create index lesson_hosts_lesson_id_idx on public.lesson_hosts (lesson_id);
create index lesson_ministries_lesson_id_idx on public.lesson_ministries (lesson_id);
create index lesson_ministries_ministry_id_idx on public.lesson_ministries (ministry_id);
