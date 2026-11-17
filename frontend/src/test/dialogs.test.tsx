import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DialogProvider, useDialogs } from '../components/common/DialogProvider';
import { CommunityFab } from '../components/layout/CommunityFab';

function Harness({ onResult }: { onResult: (v: unknown) => void }) {
  const { confirm, prompt, alert } = useDialogs();
  return (
    <div>
      <button
        onClick={async () =>
          onResult(await confirm({ title: 'Delete this post?', message: 'Gone for good.', tone: 'danger', confirmLabel: 'Delete post' }))
        }
      >
        open-confirm
      </button>
      <button
        onClick={async () =>
          onResult(
            await prompt({
              title: 'Rename routine',
              label: 'Routine name',
              initialValue: 'Push',
              validate: (v) => (v.length < 2 ? 'Too short.' : null),
            })
          )
        }
      >
        open-prompt
      </button>
      <button onClick={async () => onResult(await alert({ title: 'Heads up', message: 'Something happened.' }))}>
        open-alert
      </button>
    </div>
  );
}

const setup = () => {
  const onResult = vi.fn();
  render(
    <DialogProvider>
      <Harness onResult={onResult} />
    </DialogProvider>
  );
  return onResult;
};

describe('in-app dialogs (replace browser confirm/prompt/alert)', () => {
  it('confirm resolves true on the action button and false on Cancel', async () => {
    const onResult = setup();

    fireEvent.click(screen.getByText('open-confirm'));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    expect(dialog).toHaveTextContent('Gone for good.');
    // a destructive dialog starts focused on the safe choice
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('open-confirm'));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
  });

  it('Escape and a tap on the backdrop cancel', async () => {
    const onResult = setup();

    fireEvent.click(screen.getByText('open-confirm'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));

    fireEvent.click(screen.getByText('open-prompt'));
    await screen.findByRole('dialog', { name: 'Rename routine' });
    // the dimmed area behind the sheet is the first child of the dialog's wrapper
    const backdrop = screen.getByRole('dialog').parentElement!.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(null));
  });

  it('prompt validates, then returns the trimmed value', async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText('open-prompt'));
    const input = (await screen.findByLabelText('Routine name')) as HTMLInputElement;
    expect(input).toHaveValue('Push');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: ' a ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too short.');
    expect(onResult).not.toHaveBeenCalled(); // still open, nothing submitted

    fireEvent.change(input, { target: { value: '  Leg Day  ' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith('Leg Day'));
  });

  it('alert shows one OK button; several requests queue up in order', async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText('open-alert'));
    fireEvent.click(screen.getByText('open-confirm'));

    await screen.findByRole('alertdialog', { name: 'Heads up' });
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    // the queued confirm appears next
    await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
  });
});

describe('Community floating button', () => {
  const at = (path: string, hidden = false) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <CommunityFab hidden={hidden} />
      </MemoryRouter>
    );

  it('links to the feed from normal pages', () => {
    at('/workouts');
    const fab = screen.getByRole('link', { name: 'Open Community' });
    expect(fab).toHaveAttribute('href', '/community');
    expect(fab.className).toContain('lg:hidden'); // mobile only
  });

  it.each(['/community', '/record'])('is hidden on %s', (path) => {
    at(path);
    expect(screen.queryByRole('link', { name: 'Open Community' })).not.toBeInTheDocument();
  });

  it('is hidden while the side menu is open', () => {
    at('/', true);
    expect(screen.queryByRole('link', { name: 'Open Community' })).not.toBeInTheDocument();
  });
});


describe('coach approval wording', () => {
  it('says "A coach approved" for one and counts from two', async () => {
    const { coachApprovalText } = await import('../components/feed/CoachBadge');
    expect(coachApprovalText(0)).toBeNull();
    expect(coachApprovalText(1)).toBe('A coach approved');
    expect(coachApprovalText(2)).toBe('2 coaches approved');
  });
});
