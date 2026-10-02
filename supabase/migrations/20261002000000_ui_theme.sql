-- Appearance, chosen in Settings: the original Windows 98 look, or the iOS-style White or Black.
-- Sign-in and the public pages always use the original.
alter table public.profiles
  add column ui_theme text not null default 'classic' check (ui_theme in ('classic', 'light', 'dark'));

grant update (ui_theme) on public.profiles to authenticated;
