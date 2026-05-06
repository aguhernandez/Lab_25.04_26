import { useAuth } from '../contexts/AuthContext';
import { MembershipSlug } from './useSatelliteAuth';

const TIER_RANK: Record<MembershipSlug, number> = {
  inicia: 0,
  intermediate: 1,
  pro: 2,
};

export interface MembershipFeatures {
  canAccessLabWorkflow: boolean;
  canAccessAnthropometry: boolean;
  canAccessEnvironmentalPhysiology: boolean;
  canAccessForceVelocity: boolean;
  canAccessAdvancedMetrics: boolean;
  canExportJSON: boolean;
  canExportPDF: boolean;
  canManageMultipleAthletes: boolean;
  canAccessReferencePopulations: boolean;
  canImportManualResults: boolean;
}

const FEATURES_BY_TIER: Record<MembershipSlug, MembershipFeatures> = {
  inicia: {
    canAccessLabWorkflow: false,
    canAccessAnthropometry: false,
    canAccessEnvironmentalPhysiology: false,
    canAccessForceVelocity: false,
    canAccessAdvancedMetrics: false,
    canExportJSON: false,
    canExportPDF: false,
    canManageMultipleAthletes: false,
    canAccessReferencePopulations: false,
    canImportManualResults: true,
  },
  intermediate: {
    canAccessLabWorkflow: true,
    canAccessAnthropometry: true,
    canAccessEnvironmentalPhysiology: false,
    canAccessForceVelocity: false,
    canAccessAdvancedMetrics: true,
    canExportJSON: false,
    canExportPDF: true,
    canManageMultipleAthletes: true,
    canAccessReferencePopulations: false,
    canImportManualResults: true,
  },
  pro: {
    canAccessLabWorkflow: true,
    canAccessAnthropometry: true,
    canAccessEnvironmentalPhysiology: true,
    canAccessForceVelocity: true,
    canAccessAdvancedMetrics: true,
    canExportJSON: true,
    canExportPDF: true,
    canManageMultipleAthletes: true,
    canAccessReferencePopulations: true,
    canImportManualResults: true,
  },
};

export function useMembership() {
  const { user, profile } = useAuth();

  const slug: MembershipSlug =
    user?.membership_slug ||
    (profile?.membership_slug as MembershipSlug) ||
    'inicia';

  const name: string =
    user?.membership_name ||
    profile?.membership_name ||
    'Inicia';

  const features = FEATURES_BY_TIER[slug];

  function hasMinTier(required: MembershipSlug): boolean {
    return TIER_RANK[slug] >= TIER_RANK[required];
  }

  function can(feature: keyof MembershipFeatures): boolean {
    return features[feature];
  }

  return {
    slug,
    name,
    features,
    hasMinTier,
    can,
    isInicia: slug === 'inicia',
    isIntermediate: slug === 'intermediate',
    isPro: slug === 'pro',
  };
}
