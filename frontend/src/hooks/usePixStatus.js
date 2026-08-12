import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { toast } from '@stores/toastStore';

export function usePixStatus(rechargeId) {
  const { on, off, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handlePixConfirmed = useCallback((data) => {
    if (rechargeId && data?.rechargeId !== rechargeId) return;
    toast.success('Pagamento PIX confirmado!');
    queryClient.invalidateQueries({ queryKey: ['recharges'] });
    queryClient.invalidateQueries({ queryKey: ['pix-status'] });
  }, [rechargeId, queryClient]);

  const handlePixExpired = useCallback((data) => {
    if (rechargeId && data?.rechargeId !== rechargeId) return;
    toast.warning('PIX expirado. Gere um novo codigo.');
    queryClient.invalidateQueries({ queryKey: ['pix-status'] });
  }, [rechargeId, queryClient]);

  useEffect(() => {
    if (!isConnected) return;
    on('pix:confirmed', handlePixConfirmed);
    on('pix:expired', handlePixExpired);
    return () => {
      off('pix:confirmed', handlePixConfirmed);
      off('pix:expired', handlePixExpired);
    };
  }, [isConnected, on, off, handlePixConfirmed, handlePixExpired]);

  return { isConnected };
}
