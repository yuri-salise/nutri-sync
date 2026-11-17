import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CommunityFab } from './CommunityFab';

export const Layout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#000000] text-[#EAECEF] flex flex-col font-poppins selection:bg-[#C8FF00] selection:text-black">
      {/* Background subtle radial ambient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(200,255,0,0.035)_0%,transparent_60%)]" />

      <Navbar
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMobileMenuOpen={mobileMenuOpen}
      />

      <div className="flex flex-1 relative z-10">
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:pl-64 transition-all duration-300">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 pb-24 lg:pb-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile-Native Bottom Navigation Bar */}
      <BottomNav />
      <CommunityFab hidden={mobileMenuOpen} />
    </div>
  );
};
