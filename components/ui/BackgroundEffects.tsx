"use client";

/**
 * Enhanced background effects for the homepage
 * Includes floating orbs, gradient rings, and animated particles
 */
export function BackgroundEffects() {
  return (
    <>
      {/* Base glow layer */}
      <div className="page-glow" aria-hidden="true" />

      {/* Grain texture */}
      <div className="page-grain" aria-hidden="true" />

      {/* Floating orbs */}
      <div className="floating-orbs" aria-hidden="true">
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
      </div>

      {/* Gradient rings */}
      <div className="gradient-ring gradient-ring-1" aria-hidden="true" />
      <div className="gradient-ring gradient-ring-2" aria-hidden="true" />
    </>
  );
}

/**
 * Shimmer overlay for hero section
 */
export function HeroShimmer() {
  return <div className="shimmer-overlay" aria-hidden="true" />;
}
