import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  file_name: string | null;
  shared_item_type: string | null;
  shared_item_id: string | null;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export const useInternalMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    loadMessages();
    const cleanup = setupRealtimeSubscription();
    
    return cleanup;
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      const { data: msgs, error } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (msgs) {
        // Get sender profiles
        const senderIds = [...new Set(msgs.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedMessages: InternalMessage[] = msgs.map(msg => ({
          ...msg,
          sender: profileMap.get(msg.sender_id)
        }));

        setMessages(enrichedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!conversationId) return () => {};

    const channel = supabase
      .channel(`internal-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const newMsg = payload.new as InternalMessage;
          
          // Get sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: profile || undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = useCallback(async (
    content: string,
    messageType: string = 'text',
    mediaUrl?: string,
    fileName?: string,
    sharedItemType?: string,
    sharedItemId?: string
  ): Promise<boolean> => {
    if (!conversationId || !currentUserId) return false;

    try {
      const { error } = await supabase
        .from('internal_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content,
          message_type: messageType,
          media_url: mediaUrl || null,
          file_name: fileName || null,
          shared_item_type: sharedItemType || null,
          shared_item_id: sharedItemId || null
        });

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from('internal_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [conversationId, currentUserId]);

  const uploadMedia = useCallback(async (file: File): Promise<string | null> => {
    if (!currentUserId) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('internal-chat-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  }, [currentUserId]);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    if (!currentUserId) return false;
    try {
      const { error } = await supabase
        .from('internal_messages')
        .update({ content: newContent })
        .eq('id', messageId)
        .eq('sender_id', currentUserId);

      if (error) throw error;

      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  }, [currentUserId]);

  return {
    messages,
    loading,
    currentUserId,
    sendMessage,
    editMessage,
    uploadMedia,
    refresh: loadMessages
  };
};
