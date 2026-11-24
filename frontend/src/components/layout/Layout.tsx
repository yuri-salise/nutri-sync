import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CommunityFab } from './CommunityFab';

/** Shown while a page's code chunk downloads. */
export const PageSpinner: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Loading page">
    <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

export const Layout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col selection:bg-accent selection:text-on-accent">
      {/* Background subtle radial ambient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.035)_0%,transparent_60%)]" />

      <Navbar
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMobileMenuOpen={mobileMenuOpen}
      />

      <div className="flex flex-1 relative z-10">
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 lg:pl-64 transition-all duration-300">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 pb-24 lg:pb-8 animate-rise">
            {/* Keep the menu on screen while the next page's code loads. */}
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile-Native Bottom Navigation Bar */}
      <BottomNav />
      <CommunityFab hidden={mobileMenuOpen} />
    </div>
  );
};
