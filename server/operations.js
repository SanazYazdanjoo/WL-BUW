/** Authorized operational service boundary, shared by private staff routes. */
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
