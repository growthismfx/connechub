export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user: string
          id: string
          kind: string
          payload: Json
          to_user: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user: string
          id?: string
          kind: string
          payload: Json
          to_user: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user?: string
          id?: string
          kind?: string
          payload?: Json
          to_user?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          status: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          status?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          attachments: Json | null
          author_id: string
          channel_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to: string | null
          server_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          channel_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          server_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          channel_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "server_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_folder_items: {
        Row: {
          conversation_id: string
          folder_id: string
        }
        Insert: {
          conversation_id: string
          folder_id: string
        }
        Update: {
          conversation_id?: string
          folder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_folder_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_folders: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      chat_locks: {
        Row: {
          conversation_id: string
          created_at: string
          pin_hash: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          pin_hash: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          pin_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      close_friends: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          member_count: number
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_id: string
          community_id: string
          content: string | null
          created_at: string
          id: string
          media_url: string | null
        }
        Insert: {
          author_id: string
          community_id: string
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
        }
        Update: {
          author_id?: string
          community_id?: string
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          connected_via: string
          conversation_id: string
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          joined_at: string | null
          pinned_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          connected_via?: string
          conversation_id: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          pinned_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          connected_via?: string
          conversation_id?: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          pinned_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_group: boolean | null
          last_message: string | null
          last_message_at: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      login_alerts: {
        Row: {
          created_at: string
          device: string | null
          event: string
          id: string
          ip: string | null
          meta: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          event: string
          id?: string
          ip?: string | null
          meta?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      message_pins: {
        Row: {
          conversation_id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          conversation_id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_pins_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          call_id: string | null
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_for_everyone: boolean
          delivered_at: string | null
          edit_history: Json | null
          edited_at: string | null
          encrypted_keys: Json | null
          expires_at: string | null
          forwarded_from_id: string | null
          id: string
          is_encrypted: boolean
          is_silent: boolean
          iv: string | null
          media_url: string | null
          message_type: string | null
          read_at: string | null
          reply_to: string | null
          scheduled_for: string | null
          self_destruct_seconds: number | null
          sender_id: string
          sent: boolean
          status: string | null
        }
        Insert: {
          call_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_for_everyone?: boolean
          delivered_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          encrypted_keys?: Json | null
          expires_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_encrypted?: boolean
          is_silent?: boolean
          iv?: string | null
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          reply_to?: string | null
          scheduled_for?: string | null
          self_destruct_seconds?: number | null
          sender_id: string
          sent?: boolean
          status?: string | null
        }
        Update: {
          call_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_for_everyone?: boolean
          delivered_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          encrypted_keys?: Json | null
          expires_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_encrypted?: boolean
          is_silent?: boolean
          iv?: string | null
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          reply_to?: string | null
          scheduled_for?: string | null
          self_destruct_seconds?: number | null
          sender_id?: string
          sent?: boolean
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reactions: {
        Row: {
          body: string | null
          created_at: string
          emoji: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          emoji: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          emoji?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_reactions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          emoji: string | null
          expires_at: string
          id: string
          mentions: string[] | null
          music_title: string | null
          music_url: string | null
          user_id: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          emoji?: string | null
          expires_at?: string
          id?: string
          mentions?: string[] | null
          music_title?: string | null
          music_url?: string | null
          user_id: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          emoji?: string | null
          expires_at?: string
          id?: string
          mentions?: string[] | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          achievements: Json | null
          assigned_number: string | null
          avatar_url: string | null
          badges: string[] | null
          banner_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          id: string
          is_online: boolean | null
          last_seen: string | null
          links: Json | null
          location: string | null
          name: string | null
          profile_music_title: string | null
          profile_music_url: string | null
          profile_theme: string | null
          pronouns: string | null
          public_key: string | null
          read_receipts: boolean
          show_last_seen: boolean
          show_profile_photo: boolean
          show_status: boolean
          social_links: Json | null
          status: string | null
          updated_at: string | null
          username: string | null
          wallpaper_url: string | null
          website: string | null
        }
        Insert: {
          achievements?: Json | null
          assigned_number?: string | null
          avatar_url?: string | null
          badges?: string[] | null
          banner_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          id: string
          is_online?: boolean | null
          last_seen?: string | null
          links?: Json | null
          location?: string | null
          name?: string | null
          profile_music_title?: string | null
          profile_music_url?: string | null
          profile_theme?: string | null
          pronouns?: string | null
          public_key?: string | null
          read_receipts?: boolean
          show_last_seen?: boolean
          show_profile_photo?: boolean
          show_status?: boolean
          social_links?: Json | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
          wallpaper_url?: string | null
          website?: string | null
        }
        Update: {
          achievements?: Json | null
          assigned_number?: string | null
          avatar_url?: string | null
          badges?: string[] | null
          banner_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          links?: Json | null
          location?: string | null
          name?: string | null
          profile_music_title?: string | null
          profile_music_url?: string | null
          profile_theme?: string | null
          pronouns?: string | null
          public_key?: string | null
          read_receipts?: boolean
          show_last_seen?: boolean
          show_profile_photo?: boolean
          show_status?: boolean
          social_links?: Json | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
          wallpaper_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      server_channels: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          server_id: string
          topic: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          server_id: string
          topic?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          server_id?: string
          topic?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_emojis: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          server_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name: string
          server_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          server_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_emojis_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          id: string
          joined_at: string
          nickname: string | null
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_role_assignments: {
        Row: {
          id: string
          role_id: string
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role_id: string
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          role_id?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_role_assignments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_roles: {
        Row: {
          color: string | null
          created_at: string
          hoist: boolean
          id: string
          mentionable: boolean
          name: string
          permissions: number
          position: number
          server_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          hoist?: boolean
          id?: string
          mentionable?: boolean
          name: string
          permissions?: number
          position?: number
          server_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          hoist?: boolean
          id?: string
          mentionable?: boolean
          name?: string
          permissions?: number
          position?: number
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          invite_code: string | null
          is_public: boolean
          member_count: number
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean
          member_count?: number
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean
          member_count?: number
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      starred_messages: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      status_views: {
        Row: {
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          allow_reactions: boolean
          allow_replies: boolean
          allow_sharing: boolean
          allowed_user_ids: string[] | null
          background: string | null
          blocked_user_ids: string[] | null
          content: string | null
          countdown_end: string | null
          countdown_title: string | null
          created_at: string
          expires_at: string
          hashtags: string[] | null
          highlight_id: string | null
          id: string
          is_highlight: boolean
          layers: Json | null
          link_title: string | null
          link_url: string | null
          location: Json | null
          media_type: string | null
          media_url: string | null
          mentions: string[] | null
          music_artist: string | null
          music_duration_seconds: number | null
          music_start_seconds: number | null
          music_thumbnail: string | null
          music_title: string | null
          music_url: string | null
          mute_original: boolean | null
          poll_options: Json | null
          poll_question: string | null
          privacy: string
          question_prompt: string | null
          quiz_correct_index: number | null
          quiz_options: Json | null
          repost_of: string | null
          story_type: string
          user_id: string
        }
        Insert: {
          allow_reactions?: boolean
          allow_replies?: boolean
          allow_sharing?: boolean
          allowed_user_ids?: string[] | null
          background?: string | null
          blocked_user_ids?: string[] | null
          content?: string | null
          countdown_end?: string | null
          countdown_title?: string | null
          created_at?: string
          expires_at?: string
          hashtags?: string[] | null
          highlight_id?: string | null
          id?: string
          is_highlight?: boolean
          layers?: Json | null
          link_title?: string | null
          link_url?: string | null
          location?: Json | null
          media_type?: string | null
          media_url?: string | null
          mentions?: string[] | null
          music_artist?: string | null
          music_duration_seconds?: number | null
          music_start_seconds?: number | null
          music_thumbnail?: string | null
          music_title?: string | null
          music_url?: string | null
          mute_original?: boolean | null
          poll_options?: Json | null
          poll_question?: string | null
          privacy?: string
          question_prompt?: string | null
          quiz_correct_index?: number | null
          quiz_options?: Json | null
          repost_of?: string | null
          story_type?: string
          user_id: string
        }
        Update: {
          allow_reactions?: boolean
          allow_replies?: boolean
          allow_sharing?: boolean
          allowed_user_ids?: string[] | null
          background?: string | null
          blocked_user_ids?: string[] | null
          content?: string | null
          countdown_end?: string | null
          countdown_title?: string | null
          created_at?: string
          expires_at?: string
          hashtags?: string[] | null
          highlight_id?: string | null
          id?: string
          is_highlight?: boolean
          layers?: Json | null
          link_title?: string | null
          link_url?: string | null
          location?: Json | null
          media_type?: string | null
          media_url?: string | null
          mentions?: string[] | null
          music_artist?: string | null
          music_duration_seconds?: number | null
          music_start_seconds?: number | null
          music_thumbnail?: string | null
          music_title?: string | null
          music_url?: string | null
          mute_original?: boolean | null
          poll_options?: Json | null
          poll_question?: string | null
          privacy?: string
          question_prompt?: string | null
          quiz_correct_index?: number | null
          quiz_options?: Json | null
          repost_of?: string | null
          story_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_highlights: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      story_poll_votes: {
        Row: {
          choice_index: number
          created_at: string
          status_id: string
          user_id: string
        }
        Insert: {
          choice_index: number
          created_at?: string
          status_id: string
          user_id: string
        }
        Update: {
          choice_index?: number
          created_at?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_poll_votes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      story_replies: {
        Row: {
          body: string | null
          created_at: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_replies_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          ip: string | null
          last_active: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip?: string | null
          last_active?: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip?: string | null
          last_active?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          biometric_credentials: Json | null
          login_alerts_enabled: boolean
          passcode_enabled: boolean
          passcode_hash: string | null
          recovery_codes: string[] | null
          totp_enabled: boolean
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          biometric_credentials?: Json | null
          login_alerts_enabled?: boolean
          passcode_enabled?: boolean
          passcode_hash?: string | null
          recovery_codes?: string[] | null
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          biometric_credentials?: Json | null
          login_alerts_enabled?: boolean
          passcode_enabled?: boolean
          passcode_hash?: string | null
          recovery_codes?: string[] | null
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          tokens: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          tokens: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          tokens?: Json
          user_id?: string
        }
        Relationships: []
      }
      voice_participants: {
        Row: {
          channel_id: string
          deafened: boolean
          id: string
          joined_at: string
          muted: boolean
          server_id: string
          user_id: string
          video_on: boolean
        }
        Insert: {
          channel_id: string
          deafened?: boolean
          id?: string
          joined_at?: string
          muted?: boolean
          server_id: string
          user_id: string
          video_on?: boolean
        }
        Update: {
          channel_id?: string
          deafened?: boolean
          id?: string
          joined_at?: string
          muted?: boolean
          server_id?: string
          user_id?: string
          video_on?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "server_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_participants_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_story: {
        Args: { _status: Database["public"]["Tables"]["statuses"]["Row"] }
        Returns: boolean
      }
      find_or_create_dm: { Args: { _a: string; _b: string }; Returns: string }
      get_status_views: {
        Args: { _status_id: string }
        Returns: {
          avatar_url: string
          name: string
          viewed_at: string
          viewer_id: string
        }[]
      }
      is_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { _server: string; _user: string }
        Returns: boolean
      }
      is_server_owner: {
        Args: { _server: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
