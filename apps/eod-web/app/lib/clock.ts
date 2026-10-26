/** The current time. Tests pin it so the trading day is predictable. */
let fixed: Date | null = null;
export const now = () => (fixed ? new Date(fixed) : new Date());
export const setNow = (d: Date | null) => { fixed = d; };
