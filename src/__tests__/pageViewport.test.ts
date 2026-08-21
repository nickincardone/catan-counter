/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { scheduleMeasurement } from '../pageViewport';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deciding when to measure the viewport', () => {
  it('measures at once in a hidden tab, waiting on nothing', () => {
    // A hidden tab gets no animation frames, and Chrome throttles its timers to
    // roughly one a second — far past the 750ms the content script waits before
    // deciding the hook is missing and covering the page instead of shrinking
    // it. Measuring synchronously is the only thing neither limit can delay.
    setHidden(true);
    const frame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0);

    const measure = jest.fn();
    scheduleMeasurement(measure);

    expect(measure).toHaveBeenCalledTimes(1);
    expect(frame).not.toHaveBeenCalled();
  });

  it('waits for a frame when the page can actually paint', () => {
    setHidden(false);
    const frame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0);

    const measure = jest.fn();
    scheduleMeasurement(measure);

    expect(measure).not.toHaveBeenCalled();
    expect(frame).toHaveBeenCalled();

    (frame.mock.calls[0][0] as FrameRequestCallback)(0);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('falls back to the timer if the frame never comes', () => {
    jest.useFakeTimers();
    setHidden(false);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

    const measure = jest.fn();
    scheduleMeasurement(measure);
    expect(measure).not.toHaveBeenCalled();

    jest.advanceTimersByTime(48);
    expect(measure).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('measures once even when both the frame and the timer arrive', () => {
    jest.useFakeTimers();
    setHidden(false);
    const frame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0);

    const measure = jest.fn();
    scheduleMeasurement(measure);

    (frame.mock.calls[0][0] as FrameRequestCallback)(0);
    jest.advanceTimersByTime(100);

    expect(measure).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
