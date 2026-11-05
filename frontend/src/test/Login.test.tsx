import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';

describe('LoginPage Component (Requirement Q2)', () => {
  it('renders login heading and authentication controls', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Welcome to NutriSync/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/athlete@nutrisync.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Athlete Yuri/i)).toBeInTheDocument();
    expect(screen.getByText(/Coach Rinante/i)).toBeInTheDocument();
  });
});
