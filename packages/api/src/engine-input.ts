/**
 * Turning stored/wire data back into the engine's input shape.
 *
 * Lifted out of `index.ts` unchanged so the **alert engine can recompute a saved property
 * against today's rules** without importing the route module — which would be a cycle, since
 * `index.ts` mounts the alerts endpoint.
 */

import { minor, type PropertyInput } from "@veela/core";
import type { CreatePropertyInput } from "@veela/types";

/**
 * Map the wire shape (flat minor units) onto the engine's Money shape.
 *
 * `exactOptionalPropertyTypes` is on, so an optional field must be *absent* rather than
 * set to undefined. Building the object incrementally is clearer than a wall of
 * conditional spreads, and avoids non-null assertions entirely.
 */
export function toEngineInput(row: CreatePropertyInput): PropertyInput {
  const cur = row.currency;

  const costs: Mutable<PropertyInput["costs"]> = {
    ownerPaysRates: row.costs.ownerPaysRates,
  };
  const c = row.costs;
  if (c.monthlyManagementFeeMinor !== undefined) {
    costs.monthlyManagementFee = minor(c.monthlyManagementFeeMinor, cur);
  }
  if (c.rateableValueMinor !== undefined) {
    costs.rateableValue = minor(c.rateableValueMinor, cur);
  }
  if (c.annualOtherCostsMinor !== undefined) {
    costs.annualOtherCosts = minor(c.annualOtherCostsMinor, cur);
  }
  if (c.agencyFeeMinor !== undefined) costs.agencyFee = minor(c.agencyFeeMinor, cur);
  if (c.legalFeesMinor !== undefined) costs.legalFees = minor(c.legalFeesMinor, cur);
  if (c.vacancyRate !== undefined) costs.vacancyRate = c.vacancyRate;

  const input: Mutable<PropertyInput> = {
    currency: cur,
    price: minor(row.priceMinor, cur),
    monthlyRent: minor(row.monthlyRentMinor, cur),
    transactionDate: row.transactionDate,
    buyer: row.buyer,
    costs,
  };
  /* `!= null` rather than `!== undefined`, deliberately. This function used to be fed only
     Zod-validated wire bodies, where an absent field is `undefined`. It is now also fed rows
     straight out of Postgres, where an absent field is **`null`** — and `null` sailed past a
     `!== undefined` check and then threw on `.loanAmountMinor`. Caught the first time a saved
     property with no mortgage was recomputed for an alert. */
  if (row.saleableAreaSqft != null) input.saleableAreaSqft = row.saleableAreaSqft;
  if (row.financing != null) {
    input.financing = {
      loanAmount: minor(row.financing.loanAmountMinor, cur),
      annualInterestRate: row.financing.annualInterestRate,
      termYears: row.financing.termYears,
    };
  }
  return input;
}

/** Drop `readonly` one level deep so an object can be assembled before freezing. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };


