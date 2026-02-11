import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/external-client';
import { Loader2, Mail, RefreshCw, Trash2, UserPlus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { InviteFormDialog } from './InviteFormDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Invite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  status: string;
  expires_at: string;
  created_at: string;
}

export function InvitesList() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
      toast({
        title: 'Erro ao carregar convites',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (invite: Invite) => {
    setResending(invite.id);
    try {
      const EXTERNAL_URL = 'https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/send-invite';
      const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZXFoeGFpd2doZXhmb2JqYWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTM0ODAsImV4cCI6MjA4NTM2OTQ4MH0.N2EEwDUfWlZTWlHMJAC777eELMxmpyOyrJ087kPex3Y';

      const response = await fetch(EXTERNAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EXTERNAL_ANON_KEY,
        },
        body: JSON.stringify({
          inviteId: invite.id,
          email: invite.email,
          firstName: invite.first_name,
          lastName: invite.last_name,
          roles: invite.roles,
          appUrl: window.location.origin,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);

      toast({
        title: 'Convite reenviado!',
        description: `Email enviado para ${invite.email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reenviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setResending(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('user_invites').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Convite excluído' });
      fetchInvites();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'accepted') {
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Aceito</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
    }
    if (isExpired) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Expirado</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Convites de Usuários</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os convites enviados para novos usuários
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Convite
        </Button>
      </div>

      {invites.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="font-medium text-muted-foreground">Nenhum convite enviado</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Novo Convite" para convidar usuários
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <Card key={invite.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">
                        {invite.first_name && invite.last_name
                          ? `${invite.first_name} ${invite.last_name}`
                          : invite.email}
                      </p>
                      {invite.first_name && (
                        <p className="text-sm text-muted-foreground">{invite.email}</p>
                      )}
                    </div>
                    {getStatusBadge(invite.status, invite.expires_at)}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>Perfis: {invite.roles.join(', ')}</span>
                    <span>•</span>
                    <span>
                      Enviado em {format(new Date(invite.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {invite.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(invite)}
                      disabled={resending === invite.id}
                    >
                      {resending === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(invite.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <InviteFormDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={fetchInvites}
      />
    </div>
  );
}
