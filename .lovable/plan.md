
# Rollout Plan

Given the scope, I'll ship in 3 sequential phases. Each phase is one message so we can verify before the next.

## Phase A — Audit & Fix (this turn)

End-to-end pass on features already half-built. No new surfaces.

**Messaging**
- Reactions: verify realtime subscription + optimistic update, fix duplicate reaction rows.
- Pins: pinned banner must load on chat open (currently only updates on realtime event).
- Edit/Delete-for-everyone: confirm `edited_at` + `deleted_at` render correctly, hide content on delete.
- Read receipts / ticks: single (sent) → double grey (delivered) → double blue (read). Fix the `delivered_at` marker so it runs once per message per recipient, not on every mount.
- Reply preview: fix crash when replied message is deleted.
- Chat folders: persist selected tab, fix "+" chip creating empty folders.

**Stories**
- Fix upload path for photo/video (bucket + public URL).
- Own story visible in own ring.
- View counter increments once per viewer.

**Calls**
- Ended/missed/rejected → chat summary row (already wired via trigger, verify).
- MiniCallWidget hides after call ends.

**Presence**
- Online dot + last-seen realtime via `postgres_changes` on profiles.

**Chats list**
- Latest-message ordering, unread badge counts.

Deliverable: every touched feature tested via a short Playwright smoke against the running preview.

## Phase B — Theme Engine + Wallpapers + Profile Customization

**Theme engine** (rebuild `ThemeContext` + `index.css`)
- 8 presets: Default, iOS, Glass, Samsung One-UI, Midnight AMOLED, Neon, Material You, Gradient.
- Each preset defines: `--background`, `--surface`, `--primary`, `--bubble-radius`, `--nav-style`, `--font`, `--shadow`, `--blur`.
- Real geometry changes (radii, blur, shadow depth) — not just palette.
- New `user_themes` row stores overrides: bubble color, font size, message spacing, accent hue.
- Live preview card in Appearance panel.

**Wallpapers**
- New `chat_wallpapers` table (user_id, conversation_id nullable, image_url, gradient, blur).
- Global default + per-chat override.
- 12 built-in gradients + upload custom image.
- Applied as background layer in `Chat.tsx`.

**Profile customization**
- Extend `profiles`: `pronouns`, `location`, `website`, `social_links jsonb`, `banner_url`, `profile_song_url`, `badges text[]`.
- Story Highlights already partly there — surface on profile.
- Public profile page (`/u/:username`) with banner, bio, links, highlights, badges.
- Edit Profile page gets sections for each new field.

## Phase C — Discord-Style Servers

**Schema**: `servers`, `server_members`, `server_roles`, `server_channels` (text/voice), `channel_messages`, `role_permissions`, `server_events`.
**UI**: Server sidebar → channel list → chat/voice room.
**Voice rooms**: WebRTC mesh (reuse call infra) with mute/deafen/screen-share.
**Roles**: color, hoist, permission bitfield, assign to members.
**Custom emoji**: upload PNG/GIF to `emojis` bucket, `:name:` autocomplete in composer.

## Deferred (call out explicitly)

- Spotify / Apple / YT APIs → will use free preview APIs (Deezer public preview, iTunes Search) once Phase B ships; no API key needed.
- AI story enhancement, background removal → needs Lovable AI Gateway call, added in a follow-up.
- Biometric / passcode lock, 2FA → separate security phase.

## Technical notes

- All new tables get `GRANT` + RLS in the same migration.
- Realtime enabled on `channel_messages`, `chat_wallpapers`, `user_themes`.
- Theme preset changes are pure CSS variables — no component rewrites needed beyond `BottomNav` variants.
- Wallpaper renders via `background-image` layer at `Chat.tsx` root, `pointer-events: none` overlay for readability tint.

Reply "go" (or edit any phase) and I'll start Phase A immediately.
