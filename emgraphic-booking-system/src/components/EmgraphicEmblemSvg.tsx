import React from 'react';

interface EmgraphicEmblemSvgProps {
  className?: string;
}

export const EmgraphicEmblemSvg: React.FC<EmgraphicEmblemSvgProps> = ({ className = 'h-10 w-auto' }) => {
  return (
    <svg
      viewBox="0 0 310 215"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      aria-label="Emgraphic Studio Official Logo"
    >
      {/* Speed Bar 2 (Middle) */}
      <polygon
        points="24,108 136,108 120,138 8,138"
        fill="#F37021"
        stroke="#111111"
        strokeWidth="5.5"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
      />

      {/* Speed Bar 3 (Bottom) */}
      <polygon
        points="58,158 170,158 154,188 42,188"
        fill="#F37021"
        stroke="#111111"
        strokeWidth="5.5"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
      />

      {/* Main Continuous Ribbon (Top Bar of E + Geometric M) */}
      <polygon
        points="
          50,78
          66,48
          164,48
          206,126
          268,48
          290,48
          284,188
          258,188
          244,88
          206,156
          136,78
        "
        fill="#F37021"
        stroke="#111111"
        strokeWidth="5.5"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
      />

      {/* Gray Accent Slice on Right Leg */}
      <polygon
        points="256,64 274,64 266,132 248,132"
        fill="#7E8793"
        stroke="#111111"
        strokeWidth="4.5"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
      />
    </svg>
  );
};
