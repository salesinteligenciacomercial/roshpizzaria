import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Phone, Clock, Plus } from 'lucide-react';
import { useMeetings, IncomingCall } from '@/hooks/useMeetings';
import { MeetingHistory } from '@/components/meetings/MeetingHistory';
import { StartCallDialog } from '@/components/meetings/StartCallDialog';
import { VideoCallModal } from '@/components/meetings/VideoCallModal';
import { IncomingCallModal } from '@/components/meetings/IncomingCallModal';

const Reunioes = () => {
  const [showStartCallDialog, setShowStartCallDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    meetingId: string;
    remoteUserId: string;
    remoteUserName: string;
    callType: 'audio' | 'video';
    isCaller: boolean;
  } | null>(null);

  const {
    meetings,
    loading,
    incomingCall,
    currentUserId,
    createMeeting,
    acceptCall,
    rejectCall,
    endMeeting,
    addNotes,
    deleteMeeting,
  } = useMeetings();

  const handleStartCall = async (userId: string, userName: string, callType: 'audio' | 'video') => {
    const meeting = await createMeeting(callType, userId, userName);
    if (meeting) {
      setActiveCall({
        meetingId: meeting.id,
        remoteUserId: userId,
        remoteUserName: userName,
        callType,
        isCaller: true,
      });
      setShowStartCallDialog(false);
    }
  };

  const handleAcceptCall = async () => {
    const call = await acceptCall();
    if (call) {
      setActiveCall({
        meetingId: call.meetingId,
        remoteUserId: call.callerId,
        remoteUserName: call.callerName,
        callType: call.callType,
        isCaller: false,
      });
    }
  };

  const handleCallEnded = () => {
    if (activeCall) {
      endMeeting(activeCall.meetingId);
    }
    setActiveCall(null);
  };

  return (
    <>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
            <p className="text-muted-foreground">Chamadas de áudio e vídeo com sua equipe</p>
          </div>
          <Button onClick={() => setShowStartCallDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Chamada
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Chamadas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <MeetingHistory
              meetings={meetings}
              loading={loading}
              onAddNotes={addNotes}
              onDelete={deleteMeeting}
            />
          </TabsContent>

          <TabsContent value="calls" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Quick call cards */}
              <div
                onClick={() => setShowStartCallDialog(true)}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              >
                <div className="p-4 rounded-full bg-primary/20 mb-4">
                  <Video className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Chamada de Vídeo</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Inicie uma videochamada com um membro da equipe
                </p>
              </div>

              <div
                onClick={() => setShowStartCallDialog(true)}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-green-500/30 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition-colors"
              >
                <div className="p-4 rounded-full bg-green-500/20 mb-4">
                  <Phone className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Chamada de Áudio</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Inicie uma ligação de áudio com um membro da equipe
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Start Call Dialog */}
      <StartCallDialog
        open={showStartCallDialog}
        onClose={() => setShowStartCallDialog(false)}
        onStartCall={handleStartCall}
      />

      {/* Video Call Modal */}
      {activeCall && currentUserId && (
        <VideoCallModal
          open={true}
          onClose={() => setActiveCall(null)}
          meetingId={activeCall.meetingId}
          localUserId={currentUserId}
          remoteUserId={activeCall.remoteUserId}
          remoteUserName={activeCall.remoteUserName}
          callType={activeCall.callType}
          isCaller={activeCall.isCaller}
          onCallEnded={handleCallEnded}
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          open={true}
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={handleAcceptCall}
          onReject={rejectCall}
        />
      )}
    </>
  );
};

export default Reunioes;
