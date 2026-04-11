import { supabase } from '@/integrations/supabase/client';

export const logAudit = async (
  hotelId: string,
  userId: string,
  userName: string,
  action: string,
  tableName?: string,
  recordId?: string,
  oldValues?: any,
  newValues?: any,
) => {
  await supabase.from('audit_logs').insert({
    hotel_id: hotelId,
    user_id: userId,
    user_name: userName,
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: oldValues,
    new_values: newValues,
  } as any);
};

/** Higher-level wrapper that pulls user/hotel from params */
export const withAudit = async (
  hotelId: string,
  userId: string,
  userName: string,
  action: string,
  tableName: string,
  recordId: string | undefined,
  oldValues: any,
  newValues: any,
) => {
  try {
    await logAudit(hotelId, userId, userName, action, tableName, recordId, oldValues, newValues);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};
