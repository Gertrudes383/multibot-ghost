import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { toast } from '@stores/toastStore';

export function useTelegramNotifications() {
  const { on, off, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handleNewOrder = useCallback((data) => {
    toast.info(`Novo pedido Telegram: ${data?.username || 'usuario'}`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'telegram', 'orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  }, [queryClient]);

  const handleNewUser = useCallback((data) => {
    toast.info(`Novo usuario Telegram: ${data?.username || 'usuario'}`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'telegram', 'users'] });
  }, [queryClient]);

  const handleBotStatus = useCallback((data) => {
    const status = data?.status === 'online' ? 'online' : 'offline';
    toast[status === 'online' ? 'success' : 'warning'](`Bot ${data?.name || ''} ficou ${status}`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] });
  }, [queryClient]);

  const handleBroadcastComplete = useCallback((data) => {
    toast.success(`Broadcast concluido: ${data?.sent || 0} enviados`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'telegram', 'broadcast'] });
  }, [queryClient]);

  useEffect(() => {
    if (!isConnected) return;
    on('telegram:new-order', handleNewOrder);
    on('telegram:new-user', handleNewUser);
    on('telegram:bot-status', handleBotStatus);
    on('telegram:broadcast-complete', handleBroadcastComplete);
    return () => {
      off('telegram:new-order', handleNewOrder);
      off('telegram:new-user', handleNewUser);
      off('telegram:bot-status', handleBotStatus);
      off('telegram:broadcast-complete', handleBroadcastComplete);
    };
  }, [isConnected, on, off, handleNewOrder, handleNewUser, handleBotStatus, handleBroadcastComplete]);

  return { isConnected };
}
