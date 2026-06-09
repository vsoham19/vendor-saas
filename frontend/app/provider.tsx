'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Initialize the query client instance once inside state to secure it across renders
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // Data remains fresh for 5 minutes before background checking
        gcTime: 1000 * 60 * 30,    // Cache garbage collection holds data for 30 minutes
        refetchOnWindowFocus: false, // Prevents aggressive, unintended updates on mobile viewports
        retry: 1, // Fail fast on slow networks
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}