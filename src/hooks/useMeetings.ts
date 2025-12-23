import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Meeting {
  id: string;
  company_id: string;
  created_by: string;
  meeting_type: 'internal' | 'external';
  call_type: 'audio' | 'video';
  status: 'pending' | 'active' | 'ended' | 'missed';
  started_at: string | null;
  ended_at: string | null;
  participants: string[];
  participant_names: string[];
  notes: string | null;
  public_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomingCall {
  meetingId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}

export const useMeetings = () => {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Initialize user data
  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (userRole) {
          setCompanyId(userRole.company_id);
        }
      }
    };
    initUser();
  }, []);

  // Load meetings
  const loadMeetings = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMeetings((data || []) as Meeting[]);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // NOTE: Incoming call subscription is handled by GlobalCallListenerV2
  // This hook only manages meeting history and creating calls

  // Load meetings when company is set
  useEffect(() => {
    if (companyId) {
      loadMeetings();
    }
  }, [companyId, loadMeetings]);

  // Create meeting
  const createMeeting = useCallback(async (
    callType: 'audio' | 'video',
    targetUserId: string,
    targetUserName: string
  ): Promise<Meeting | null> => {
    if (!currentUserId || !companyId) return null;

    try {
      // Get current user name
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .maybeSingle();

      const { data, error } = await supabase
        .from('meetings')
        .insert({
          company_id: companyId,
          created_by: currentUserId,
          meeting_type: 'internal',
          call_type: callType,
          status: 'pending',
          participants: [currentUserId, targetUserId],
          participant_names: [myProfile?.full_name || 'Eu', targetUserName],
        })
        .select()
        .single();

      if (error) throw error;

      // Send call request signal
      await supabase.from('meeting_signals').insert({
        meeting_id: data.id,
        from_user: currentUserId,
        to_user: targetUserId,
        signal_type: 'call-request',
        signal_data: { callType },
      });

      return data as Meeting;
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível iniciar a chamada',
      });
      return null;
    }
  }, [currentUserId, companyId, toast]);

  // NOTE: acceptCall and rejectCall are now handled by GlobalCallListenerV2

  // End meeting
  const endMeeting = useCallback(async (meetingId: string) => {
    try {
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', meetingId);

      loadMeetings();
    } catch (error) {
      console.error('Error ending meeting:', error);
    }
  }, [loadMeetings]);

  // Add notes to meeting
  const addNotes = useCallback(async (meetingId: string, notes: string) => {
    try {
      await supabase
        .from('meetings')
        .update({ notes })
        .eq('id', meetingId);

      loadMeetings();
    } catch (error) {
      console.error('Error adding notes:', error);
    }
  }, [loadMeetings]);

  // Delete meeting
  const deleteMeeting = useCallback(async (meetingId: string) => {
    try {
      await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      loadMeetings();
      toast({
        title: 'Reunião excluída',
        description: 'A reunião foi removida do histórico',
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
    }
  }, [loadMeetings, toast]);

  return {
    meetings,
    loading,
    currentUserId,
    companyId,
    createMeeting,
    endMeeting,
    addNotes,
    deleteMeeting,
    loadMeetings,
  };
};
