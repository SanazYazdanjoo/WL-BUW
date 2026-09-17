/**
 * Server-only operational boundary. A future adapter must authenticate and
 * authorize the actor BEFORE reading/writing persistent records. Nothing here
 * is wired to public routes. Do not replace this with localStorage or files.
 * Proposed contracts:
 * listArrivals(actor, date) -> Arrival[]
 * checkIn(actor, {arrivalId, status}) -> {id, tutorId, recordedAt}
 * addHandover(actor, {shiftId, note}) -> {id, tutorId, recordedAt}
 * Actor identity and timestamps must be assigned/verified server-side.
 */
export function createOperationsService({ authorize, repository }) {
  return {
    async listArrivals(session, date) {
      const actor = await authorize(session, "arrivals:read");
      if (!actor?.id) throw new Error("Staff access required");
      return repository.listArrivals(actor, date);
    },
    async checkIn(session, input) {
      const actor = await authorize(session, "arrivals:write");
      if (!actor?.id) throw new Error("Staff access required");
      return repository.checkIn(actor, input);
    },
    async addHandover(session, input) {
      const actor = await authorize(session, "handover:write");
      if (!actor?.id) throw new Error("Staff access required");
      return repository.addHandover(actor, input);
    },
  };
}
