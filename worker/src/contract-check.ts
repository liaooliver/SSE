/**
 * Compile-time check that `domain.ts` provides every value named by `contracts/domain.d.ts`
 * with a compatible type (AGENTS §9.5). Type-only: emits no code.
 */
import type * as Contract from "../../contracts/domain";
import type * as Domain from "./domain";

type Assignable<Actual extends Expected, Expected> = [Actual, Expected];

/** Fails `npm run typecheck` when `domain.ts` drifts from the contract. */
export type DomainMatchesContract = Assignable<typeof Domain, typeof Contract>;
