import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ActivityDetailPage } from '../pages/ActivityDetailPage';
import { DialogProvider } from '../components/common/DialogProvider';
import { api } from '../services/api';
import type { RunActivity } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 }, token: 't', role: 'athlete', loading: false }),
}));

vi.mock('../services/api', () => ({
  api: { getRun: vi.fn(), deleteRun: vi.fn() },
}));

const sample: RunActivity = {
  id: 12,
  user_id: 7,
  sport_type: 'run',
  title: 'Morning loop',
  surface_type: 'road',
  distance_km: 5,
  duration_sec: 1800,
  elevation_gain_m: 42,
  burned_kcal: 320,
  route_geojson: JSON.stringify({
    type: 'LineString',
    coordinates: [
      [120.98, 14.58],
      [120.99, 14.59],
      [121.0, 14.6],
    ],
  }),
  is_public: false,
  recorded_at: '2026-11-17T06:00:00Z',
};

const renderAt = (path: string) =>
  render(
    <DialogProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/record/:id" element={<ActivityDetailPage />} />
          <Route path="/record" element={<p>Activities list</p>} />
        </Routes>
      </MemoryRouter>
    </DialogProvider>
  );

describe('ActivityDetailPage (requirement F2)', () => {
  beforeEach(() => {
    vi.mocked(api.getRun).mockReset();
  });

  it('shows the activity with its metrics and a delete button for the owner', async () => {
    vi.mocked(api.getRun).mockResolvedValue(sample);
    renderAt('/record/12');

    expect(await screen.findByRole('heading', { name: /Morning loop/i })).toBeInTheDocument();
    expect(screen.getByText('5.00 km')).toBeInTheDocument();
    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByText('6:00 /km')).toBeInTheDocument();
    expect(screen.getByText(/42 m/)).toBeInTheDocument();
    expect(screen.getByText(/Private/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete activity/i })).toBeInTheDocument();
    expect(api.getRun).toHaveBeenCalledWith(12);
  });

  it('hides the delete button for activities that belong to someone else', async () => {
    vi.mocked(api.getRun).mockResolvedValue({ ...sample, user_id: 99, is_public: true });
    renderAt('/record/12');

    expect(await screen.findByRole('heading', { name: /Morning loop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete activity/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Shared/)).toBeInTheDocument();
  });

  it('shows the server error instead of swallowing it', async () => {
    vi.mocked(api.getRun).mockRejectedValue(new Error('Run activity not found'));
    renderAt('/record/404');

    expect(await screen.findByRole('alert')).toHaveTextContent('Run activity not found');
  });

  it('rejects a non-numeric id without calling the API', async () => {
    renderAt('/record/abc');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid/i);
    expect(api.getRun).not.toHaveBeenCalled();
  });
});
