import { supabase } from '@/src/infrastructure/supabase/client';
import { UserProfile } from '@/src/domain/entities/User';

export class SupabaseUserProfileRepository {
  async getByFamilyGroup(familyGroupId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('family_group_id', familyGroupId);

    if (error) {
      console.error('[SupabaseUserProfileRepository] getByFamilyGroup error:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(this.mapToDomain);
  }

  private mapToDomain(row: any): UserProfile {
    return {
      id: row.id,
      authUserId: row.auth_user_id,
      familyGroupId: row.family_group_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    };
  }
}
