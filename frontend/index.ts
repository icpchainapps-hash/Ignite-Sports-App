import type { ApprovalStatus } from '../backend';

export interface Club {
  id: string;
  name: string;
  createdAt: bigint;
  admins: Array<any>;
  logoPath?: string;
  sport?: string;
  subscriptionPlan?: 'free' | 'pro' | 'proFootball';
}

export type { ApprovalStatus };

