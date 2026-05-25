import React, { SVGProps } from 'react';

export function CertificateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Document Outline */}
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      
      {/* Medical Cross */}
      <path d="M11 10v4" />
      <path d="M9 12h4" />
      
      {/* Certificate Badge with Ribbon */}
      <circle cx="16" cy="16" r="2" />
      <path d="m14.6 17.5-.6 3.5 2-1 2 1-.6-3.5" />
    </svg>
  );
}
