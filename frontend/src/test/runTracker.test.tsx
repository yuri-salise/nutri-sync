import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { RunTrackerPage } from '../pages/RunTrackerPage';
import { api } from '../services/api';

vi.mock('leaflet', () => {
  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    panTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  };
  const layerMock = {
    addTo: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    setLatLngs: vi.fn().mockReturnThis(),
    setRadius: vi.fn().mockReturnThis(),
  };
  return {
    default: {
      map: vi.fn(() => mapMock),
      tileLayer: vi.fn(() => layerMock),
      polyline: vi.fn(() => layerMock),
      circleMarker: vi.fn(() => layerMock),
      circle: vi.fn(() => layerMock),
      control: {
        zoom: vi.fn(() => ({ addTo: vi.fn() })),
      },
    },
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', full_name: 'Test Athlete', weight_kg: 70 },
    role: 'athlete',
  }),
}));

describe('RunTrackerPage - Activity Visibility during Recording', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getRuns').mockResolvedValue({ data: [] } as any);
  });

  it('clearly displays which activity is selected before starting', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <RunTrackerPage />
        </BrowserRouter>
      );
    });

    // Initial state: Run is default selected
    expect(screen.getByRole('button', { name: /Run/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Walk/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Ride/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Hike/i })).toHaveAttribute('aria-pressed', 'false');

    // Switch to Ride
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Ride/i }));
    });
    expect(screen.getByRole('button', { name: /Ride/i })).toHaveAttribute('aria-pressed', 'true');

    // Enable demo mode so Start button becomes enabled without live GPS
    const demoCheckbox = screen.getByLabelText(/Demo mode/i);
    act(() => {
      fireEvent.click(demoCheckbox);
    });

    // The start button explicitly indicates the activity
    expect(screen.getByRole('button', { name: /Start Ride/i })).toBeInTheDocument();
  });

  it('keeps the active activity visible everywhere after starting (not blind to what is recorded)', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <RunTrackerPage />
        </BrowserRouter>
      );
    });

    // Select "Hike"
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Hike/i }));
    });
    expect(screen.getByRole('button', { name: /Hike/i })).toHaveAttribute('aria-pressed', 'true');

    // Enable demo mode to start
    act(() => {
      fireEvent.click(screen.getByLabelText(/Demo mode/i));
    });

    const startBtn = screen.getByRole('button', { name: /Start Hike/i });
    expect(startBtn).toBeInTheDocument();
    act(() => {
      fireEvent.click(startBtn);
    });

    // 1. Header Active Activity Badge is rendered with sport details and Live indicator
    const headerBadge = screen.getByTestId('header-active-activity');
    expect(headerBadge).toBeInTheDocument();
    expect(headerBadge).toHaveTextContent(/Hike/i);
    expect(headerBadge).toHaveTextContent(/Live/i);

    // 2. Stats & Controls Banner clearly displays "Currently Recording: Hike"
    const statsBanner = screen.getByTestId('stats-active-activity');
    expect(statsBanner).toBeInTheDocument();
    expect(statsBanner).toHaveTextContent(/Currently Recording/i);
    expect(statsBanner).toHaveTextContent(/Hike/i);
    expect(statsBanner).toHaveTextContent(/Live/i);

    // 3. Sticky Recording Bar at the top of the viewport displays the activity name & live indicator
    const stickyBar = screen.getByTestId('sticky-recording-bar');
    expect(stickyBar).toBeInTheDocument();
    expect(stickyBar).toHaveTextContent(/Recording Hike/i);
    expect(stickyBar).toHaveTextContent(/Live/i);

    // 4. Control buttons explicitly mention the activity name
    expect(screen.getByRole('button', { name: /Pause Hike/i })).toBeInTheDocument();

    // 5. Calorie bonus mentions the activity
    expect(screen.getByText(/Hike calorie bonus/i)).toBeInTheDocument();

    // Now Pause the activity
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Pause Hike/i }));
    });

    // Status changes to Paused across indicators
    expect(screen.getByTestId('header-active-activity')).toHaveTextContent(/Paused/i);
    expect(screen.getByTestId('stats-active-activity')).toHaveTextContent(/Paused/i);
    expect(screen.getByTestId('sticky-recording-bar')).toHaveTextContent(/Hike \(Paused\)/i);

    // Resume button and Discard button explicitly name the activity
    expect(screen.getByRole('button', { name: /Resume Hike/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard this hike/i })).toBeInTheDocument();
  });
});
