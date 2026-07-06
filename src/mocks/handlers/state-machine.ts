/**
 * A class that keeps track of the current mocked phase, and allows setting up
 * delayed transitions or resetting the state if needed.
 */
export class StateMachine<T> {
  private currentPhase: T;
  private readonly initialPhase: T;
  private transitionTimer: ReturnType<typeof setTimeout> | null;

  constructor(initialPhase: T) {
    this.currentPhase = initialPhase;
    this.initialPhase = initialPhase;
    this.transitionTimer = null;
  }

  /**
   * Schedules a transition to happen in the future.
   * @param target The target phase to transition to.
   * @param delayMs the delay in milliseconds. Defaults to 3000.
   */
  public scheduleTransition(target: T, delayMs: number = 1000 * 3) {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }

    this.transitionTimer = setTimeout(() => {
      this.currentPhase = target;
    }, delayMs);
  }

  /**
   * Get the current phase of T.
   * @returns The current mocked T phase.
   */
  public getPhase(): T {
    return this.currentPhase;
  }

  /**
   * Sets the phase.
   * @param phase The phase to transition the machine to.
   */
  public setPhase(phase: T): void {
    this.currentPhase = phase;
  }

  /**
   * Resets the state machine to its defaults.
   */
  public reset(): void {
    this.currentPhase = this.initialPhase;

    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }
  }
}
