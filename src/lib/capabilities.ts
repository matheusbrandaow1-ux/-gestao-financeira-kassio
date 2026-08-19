import { UserRole } from '../types';

export interface Capabilities {
  canManageIntegrations: boolean;
  canEditAccounts: boolean;
  canEditTransactions: boolean;
  canEditBudget: boolean;
  canEditAssets: boolean;
  canManageGoals: boolean;
}

export function getCapabilities(role: UserRole): Capabilities {
  const canManage = role === 'CONSULTANT' || role === 'CONSULTOR' || role === 'ADMIN' || role === 'ADMINISTRADOR';
  return {
    canManageIntegrations: canManage,
    canEditAccounts: canManage,
    canEditTransactions: canManage,
    canEditBudget: canManage,
    canEditAssets: canManage,
    canManageGoals: canManage
  };
}
