import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';

export function useStockUpdates() {
  const { on, off, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handleStockChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  }, [queryClient]);

  useEffect(() => {
    if (!isConnected) return;
    on('cards:stock-updated', handleStockChange);
    return () => off('cards:stock-updated', handleStockChange);
  }, [isConnected, on, off, handleStockChange]);

  return { isConnected };
}
