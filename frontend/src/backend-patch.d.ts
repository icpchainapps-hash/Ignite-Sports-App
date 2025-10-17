// Type patch for auto-generated backend.ts
// This file adds missing type exports that should be in the generated backend interface

import { _ApprovalStatus } from './backend';

declare module './backend' {
  // Export the ApprovalStatus type that's referenced but not exported in backend.ts
  export type ApprovalStatus = _ApprovalStatus;
}
