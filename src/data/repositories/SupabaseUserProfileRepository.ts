import { supabase } from '@/src/infrastructure/supabase/client';
import { UserProfile } from '@/src/domain/entities/User';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../../infrastructure/utils/network';

const CACHED_PROFILES_PREFIX = '@zenmoney_cached_family_profiles_';

export class SupabaseUserProfileRepository {
  async getByFamilyGroup(familyGroupId: string, preferCache = false): Promise<UserProfile[]> {
    const cacheKey = `${CACHED_PROFILES_PREFIX}${familyGroupId}`;

    // 1. FAST PATH: Si se prefiere caché, leer de AsyncStorage de inmediato (< 2ms)
    if (preferCache) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fallback
      }
    }

    // 2. Intentar consultar Supabase con timeout defensivo de 2.5s
    try {
      const queryPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('family_group_id', familyGroupId);

      const res = await withTimeout(queryPromise, 2500, null);
      if (res && res.data && Array.isArray(res.data)) {
        const profiles = res.data.map(this.mapToDomain);
        if (profiles.length > 0) {
          AsyncStorage.setItem(cacheKey, JSON.stringify(profiles)).catch(() => {});
          return profiles;
        }
      }
    } catch (err) {
      console.warn('[SupabaseUserProfileRepository] Error o timeout al consultar perfiles remotos:', err);
    }

    // 3. Fallback a caché local si la consulta remota falló o expiró
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // 4. Último fallback: usar el perfil actual en memoria si pertenece a este grupo
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const current = useAuthStore.getState().userProfile;
      if (current && current.familyGroupId === familyGroupId) {
        return [current];
      }
    } catch {}

    return [];
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
