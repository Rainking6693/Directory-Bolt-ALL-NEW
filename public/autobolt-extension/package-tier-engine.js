/**
 * PackageTierEngine - AutoBolt Extension Package Management
 * 
 * Handles customer package validation and directory limits for AutoBolt extension
 */

class PackageTierEngine {
  constructor() {
    this.packageTiers = {
      'starter': {
        maxDirectories: 50,
        features: ['basic_submission', 'email_support'],
        priority: 'standard'
      },
      'growth': {
        maxDirectories: 75,
        features: ['basic_submission', 'priority_support', 'analytics'],
        priority: 'high'
      },
      'professional': {
        maxDirectories: 150,
        features: ['basic_submission', 'priority_support', 'analytics', 'custom_templates'],
        priority: 'high'
      },
      'enterprise': {
        maxDirectories: 500,
        features: ['basic_submission', 'priority_support', 'analytics', 'custom_templates', 'api_access'],
        priority: 'premium'
      }
    };
  }

  /**
   * Get package information by tier name
   */
  getPackageInfo(packageType) {
    const normalizedType = packageType?.toLowerCase() || 'starter';
    return this.packageTiers[normalizedType] || this.packageTiers['starter'];
  }

  /**
   * Get maximum directories allowed for a package
   */
  getMaxDirectories(packageType) {
    const packageInfo = this.getPackageInfo(packageType);
    return packageInfo.maxDirectories;
  }

  /**
   * Check if a feature is available for a package
   */
  hasFeature(packageType, feature) {
    const packageInfo = this.getPackageInfo(packageType);
    return packageInfo.features.includes(feature);
  }

  /**
   * Get submission priority for a package
   */
  getSubmissionPriority(packageType) {
    const packageInfo = this.getPackageInfo(packageType);
    return packageInfo.priority;
  }

  /**
   * Validate if customer can submit to additional directories
   */
  canSubmitToDirectories(packageType, currentSubmissions, requestedDirectories) {
    const maxDirectories = this.getMaxDirectories(packageType);
    const totalRequested = currentSubmissions + requestedDirectories;
    
    return {
      allowed: totalRequested <= maxDirectories,
      maxDirectories,
      currentSubmissions,
      requestedDirectories,
      totalRequested,
      remaining: Math.max(0, maxDirectories - currentSubmissions)
    };
  }

  /**
   * Get package upgrade recommendations
   */
  getUpgradeRecommendations(currentPackage, desiredDirectories) {
    const currentMax = this.getMaxDirectories(currentPackage);
    
    if (desiredDirectories <= currentMax) {
      return null; // No upgrade needed
    }

    // Find the minimum package that supports the desired directories
    const packageOptions = Object.keys(this.packageTiers);
    for (const packageType of packageOptions) {
      const maxDirs = this.getMaxDirectories(packageType);
      if (maxDirs >= desiredDirectories) {
        return {
          recommendedPackage: packageType,
          maxDirectories: maxDirs,
          currentPackage,
          currentMax,
          desiredDirectories
        };
      }
    }

    return {
      recommendedPackage: 'enterprise',
      maxDirectories: this.getMaxDirectories('enterprise'),
      currentPackage,
      currentMax,
      desiredDirectories
    };
  }

  /**
   * Format package information for display
   */
  formatPackageDisplay(packageType) {
    const packageInfo = this.getPackageInfo(packageType);
    return {
      name: packageType.charAt(0).toUpperCase() + packageType.slice(1),
      maxDirectories: packageInfo.maxDirectories,
      features: packageInfo.features,
      priority: packageInfo.priority
    };
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PackageTierEngine;
} else if (typeof window !== 'undefined') {
  window.PackageTierEngine = PackageTierEngine;
}